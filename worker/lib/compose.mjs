import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { ffmpeg, probeDuration } from './ffmpeg.mjs'
import { buildAss } from './subtitles.mjs'

const W = 1080
const H = 1920
const FPS = 30

/** BGM 相对旁白压低多少 dB。-20 大约是"听得见但不抢话" */
const BGM_GAIN_DB = Number(process.env.BGM_GAIN_DB || -20)
/** BGM 的高切频率。低于此的交给人声和撞击,音乐不占 */
const BGM_HIGHPASS_HZ = Number(process.env.BGM_HIGHPASS_HZ || 180)
/** 成片响度目标。参考视频实测 -12.6 LUFS,比社交平台常见的 -14 更冲一点 */
const LOUDNESS_LUFS = Number(process.env.LOUDNESS_LUFS || -13)
/** 最后一句念完再留一点尾巴,不要话音未落画面就黑 */
const TAIL_SEC = Number(process.env.TAIL_SEC || 0.8)

/**
 * 反转点的节奏断点。参考视频实测:讲到揭晓前音乐先掉到 -40dB 憋住,
 * 然后 100ms 内跳升 35dB 落一记低频撞击,再回到正常电平。
 * 参考里憋了 3.2 秒,那是配合画面的;这里默认 0.9 秒——竖屏短视频里
 * 三秒静音是拿完播率赌博,不值得。
 */
const TURN_STING = process.env.TURN_STING !== 'false'
const TURN_DIP_SEC = Number(process.env.TURN_DIP_SEC || 0.9)
const BURN_SUBTITLES = process.env.BURN_SUBTITLES !== 'false'
const CRF = process.env.VIDEO_CRF || '20'
const PRESET = process.env.VIDEO_PRESET || 'medium'

/**
 * 静态图的运镜。分镜模型给的 cameraMove 决定推近/拉远/横移,
 * 没有它整条片子就是一串幻灯片——这是知识类短视频最劝退的形态。
 *
 * 先放大到 2 倍再 zoompan,是为了压住 zoompan 在慢速缩放时的抖动。
 */
function kenBurns(cameraMove, durationSec) {
  const frames = Math.max(2, Math.round(durationSec * FPS))
  const base = `scale=${W * 2}:${H * 2}:force_original_aspect_ratio=increase,crop=${W * 2}:${H * 2}`
  const center = { x: `iw/2-(iw/zoom/2)`, y: `ih/2-(ih/zoom/2)` }

  let z
  let x = center.x
  let y = center.y
  switch (cameraMove) {
    case 'depth': // 拉远:从紧到松,适合"退一步看全局"
      z = `if(eq(on,1),1.14,max(zoom-${(0.14 / frames).toFixed(8)},1.0))`
      break
    case 'pan': // 横移:焦距不动,视点从左到右
      z = '1.12'
      x = `(iw-iw/zoom)*on/${frames}`
      break
    case 'particles': // 慢推,给粒子/光效留呼吸感
      z = `min(zoom+${(0.07 / frames).toFixed(8)},1.07)`
      break
    case 'glow':
      z = `min(zoom+${(0.09 / frames).toFixed(8)},1.09)`
      break
    case 'push_in':
    default: // 推近:默认动作
      z = `min(zoom+${(0.13 / frames).toFixed(8)},1.13)`
      break
  }
  return `${base},zoompan=z='${z}':d=${frames}:x='${x}':y='${y}':s=${W}x${H}:fps=${FPS},setsar=1,format=yuv420p`
}

/** 动态镜头:seedance 出的片子本身就是竖屏,统一到画布尺寸并对齐目标时长 */
function motionFilter(clipDuration, targetDuration) {
  const fit = `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},fps=${FPS},setsar=1,format=yuv420p`
  // 片子比这个镜头短就冻住最后一帧补齐,长就直接切掉多余部分
  if (clipDuration > 0 && clipDuration < targetDuration - 0.05) {
    return `${fit},tpad=stop_mode=clone:stop_duration=${(targetDuration - clipDuration).toFixed(3)}`
  }
  return fit
}

async function renderSegment(shot, outFile) {
  const dur = shot.scaledDuration.toFixed(3)
  if (shot.type === 'motion' && shot.motionFile) {
    const clipDur = await probeDuration(shot.motionFile)
    await ffmpeg([
      '-i', shot.motionFile,
      '-t', dur,
      '-vf', motionFilter(clipDur, shot.scaledDuration),
      '-an',
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p',
      '-r', String(FPS),
      outFile,
    ])
    return
  }
  await ffmpeg([
    '-loop', '1', '-i', shot.imageFile,
    '-t', dur,
    '-vf', kenBurns(shot.cameraMove, shot.scaledDuration),
    '-an',
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p',
    '-r', String(FPS),
    outFile,
  ])
}

/**
 * BGM 的音量包络。除了整体的淡入淡出,反转点前会挖一个坑:
 * 提前 TURN_DIP_SEC 秒滑到近乎无声,撞击落下后再滑回来。
 *
 * 用 volume 的时间表达式而不是串 afade——afade=t=in 会把 st 之前的全部变成静音,
 * 串在中间等于把前半条曲子抹掉。
 */
function bgmEnvelope(totalDuration, turnAt) {
  const fadeOutStart = Math.max(0, totalDuration - 2.5).toFixed(3)
  const base = `afade=t=in:st=0:d=1.5,afade=t=out:st=${fadeOutStart}:d=2.5`
  if (!TURN_STING || turnAt == null) return base

  const dipStart = Math.max(0.5, turnAt - TURN_DIP_SEC)
  const ramp = 0.25 // 滑下去和滑回来各用多久
  const floor = 0.07 // 坑底保留一点点,全静音会听出"断带"
  const a = dipStart.toFixed(3)
  const b = (dipStart + ramp).toFixed(3)
  const c = turnAt.toFixed(3)
  const d = (turnAt + 0.5).toFixed(3)
  const expr =
    `if(lt(t,${a}),1,` +
    `if(lt(t,${b}),1-(1-${floor})*(t-${a})/${ramp},` +
    `if(lt(t,${c}),${floor},` +
    `if(lt(t,${d}),${floor}+(1-${floor})*(t-${c})/0.5,1))))`
  return `${base},volume=volume='${expr}':eval=frame`
}

/**
 * 音轨:旁白在上,BGM 垫在下面并做侧链闪避——
 * 有人声时音乐自动让路,没人声时音乐回来。固定音量做不到这一点,
 * 要么盖住讲话,要么整条听起来是"忘了关的背景音"。
 */
function audioFilter({ voInput, bgmInput, stingInput, totalDuration, turnAt }) {
  const vo = `[${voInput}:a]aresample=48000,highpass=f=80,acompressor=threshold=0.1:ratio=3:attack=15:release=250[vo]`
  if (bgmInput == null) {
    return `${vo};[vo]loudnorm=I=${LOUDNESS_LUFS}:TP=-1.5:LRA=11,alimiter=limit=0.97[aout]`
  }
  const parts = [
    vo,
    `[vo]asplit=2[vo_main][vo_key]`,
    // BGM 比成片短就循环补齐,长就裁掉
    // 高切:把 BGM 的低频让出来。男声基频在 120Hz 上下,撞击在 40-90Hz,
    // 音乐再占着这一段就会糊成一片。参考视频的音乐低频只占 29%,
    // 而生成的曲子普遍在 45-57%——不切的话压在旁白下面是闷的。
    `[${bgmInput}:a]aresample=48000,aloop=loop=-1:size=2147483647,atrim=0:${totalDuration.toFixed(3)},asetpts=N/SR/TB,` +
      `highpass=f=${BGM_HIGHPASS_HZ}:poles=2,` +
      `volume=${BGM_GAIN_DB}dB,${bgmEnvelope(totalDuration, turnAt)}[bgm]`,
    `[bgm][vo_key]sidechaincompress=threshold=0.03:ratio=12:attack=25:release=350:makeup=1[bgm_ducked]`,
  ]

  if (stingInput != null && turnAt != null) {
    // 撞击垫到反转点上。它不进侧链——这一下就是要盖过一切,让人抬头
    parts.push(`[${stingInput}:a]aresample=48000,adelay=${Math.round(turnAt * 1000)}|${Math.round(turnAt * 1000)}[sting]`)
    parts.push(`[vo_main][bgm_ducked][sting]amix=inputs=3:duration=first:normalize=0[mix]`)
  } else {
    parts.push(`[vo_main][bgm_ducked]amix=inputs=2:duration=first:normalize=0[mix]`)
  }

  parts.push(`[mix]loudnorm=I=${LOUDNESS_LUFS}:TP=-1.5:LRA=11,alimiter=limit=0.97[aout]`)
  return parts.join(';')
}

/**
 * 生成低频撞击音:90Hz 滑到 40Hz,指数衰减 1.2 秒。
 * 现算而不是打包一个音频文件——省得镜像里多一个二进制资产,
 * 参数也能直接调。
 */
async function makeSting(outFile) {
  const dur = 1.2
  // 频率随时间下滑,相位是频率的积分,所以是 t - t^2 那一项
  const expr = `0.9*exp(-3*t)*sin(2*PI*(90*t-20.8*t*t))`
  await ffmpeg([
    '-f', 'lavfi', '-i', `aevalsrc=${expr}:s=48000:d=${dur}`,
    '-af', 'lowpass=f=160,afade=t=out:st=0.9:d=0.3',
    '-c:a', 'pcm_s16le', '-ac', '2',
    outFile,
  ])
  return outFile
}

/**
 * 把一条内容的所有素材烧成 1080x1920 成片。
 * 返回 { file, meta }。
 */
export async function composeVideo(job, { downloadTo, log = () => {} }) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), `bb-compose-${job.itemId}-`))
  try {
    // 1. 拉素材
    const files = await downloadTo(dir)
    const voFile = files.voiceover
    if (!voFile) throw new Error('没有配音文件,无法合成')

    // 2. 成片时长对齐真实配音长度。分镜的 durationSec 是模型估的,
    //    直接用会导致画面比声音短一截或长一截。
    const voDuration = await probeDuration(voFile)
    if (!voDuration) throw new Error('配音文件读不出时长,可能是占位文件')
    const target = voDuration + TAIL_SEC
    const rawTotal = job.shots.reduce((s, sh) => s + (sh.durationSec || 0), 0) || target
    const scale = target / rawTotal

    const shots = []
    let cursor = 0
    for (const sh of job.shots) {
      const imageFile = files.shotImages[sh.idx]
      const motionFile = files.motionClips[sh.idx]
      if (!imageFile && !motionFile) {
        log(`镜头 ${sh.idx} 没有画面素材,跳过`)
        continue
      }
      const scaledDuration = Math.max(1.2, (sh.durationSec || 0) * scale)
      shots.push({ ...sh, imageFile, motionFile, scaledDuration, startSec: cursor })
      cursor += scaledDuration
    }
    if (!shots.length) throw new Error('没有任何可用的镜头素材')

    // 跳过镜头会让总长和配音再次错位,按实际用上的镜头再归一化一次
    const fix = target / cursor
    let t = 0
    for (const sh of shots) {
      sh.scaledDuration = Math.max(1.0, sh.scaledDuration * fix)
      sh.startSec = t
      t += sh.scaledDuration
    }
    const totalDuration = t
    log(`配音 ${voDuration.toFixed(1)}s → 成片 ${totalDuration.toFixed(1)}s,${shots.length} 个镜头`)

    // 3. 逐镜头渲染
    const segDir = path.join(dir, 'seg')
    await fs.mkdir(segDir, { recursive: true })
    const segments = []
    for (const sh of shots) {
      const out = path.join(segDir, `seg_${String(sh.idx).padStart(3, '0')}.mp4`)
      await renderSegment(sh, out)
      segments.push(out)
      log(`镜头 ${sh.idx} (${sh.type}, ${sh.scaledDuration.toFixed(1)}s) 完成`)
    }

    // 4. 字幕按缩放后的时间轴重算
    const assFile = path.join(dir, 'burn.ass')
    await fs.writeFile(assFile, buildAss(shots, { width: W, height: H }), 'utf-8')

    // 5. 拼接 + 混音 + 烧字幕,一次成片
    const listFile = path.join(dir, 'concat.txt')
    await fs.writeFile(listFile, segments.map((s) => `file '${s.replace(/'/g, "'\\''")}'`).join('\n'), 'utf-8')

    const outFile = path.join(dir, 'final.mp4')
    const hasBgm = Boolean(files.bgm)

    // 反转点落在哪一秒:分镜标了就用,标的下标不存在就当没标
    const turnShot = job.turnShotIdx == null ? null : shots.find((sh) => sh.idx === job.turnShotIdx)
    const turnAt = turnShot ? turnShot.startSec : null
    const stingFile = hasBgm && TURN_STING && turnAt != null ? await makeSting(path.join(dir, 'sting.wav')) : null
    if (turnAt != null) log(`反转点在镜头 ${job.turnShotIdx} / ${turnAt.toFixed(1)}s${stingFile ? ',加低频撞击' : ''}`)
    // ass 滤镜的文件名要转义 : 和 \,否则会被当成参数分隔符
    const assArg = assFile.replace(/\\/g, '\\\\').replace(/:/g, '\\:')
    const videoChain = [
      `[0:v]scale=${W}:${H},setsar=1`,
      BURN_SUBTITLES ? `ass='${assArg}'` : null,
      'format=yuv420p[vout]',
    ]
      .filter(Boolean)
      .join(',')

    const args = [
      '-f', 'concat', '-safe', '0', '-i', listFile,
      '-i', voFile,
      ...(hasBgm ? ['-i', files.bgm] : []),
      ...(stingFile ? ['-i', stingFile] : []),
      // 输入顺序:0=拼接后的画面,1=旁白,2=BGM(有的话),3=撞击(有的话)
      '-filter_complex',
      `${videoChain};${audioFilter({
        voInput: 1,
        bgmInput: hasBgm ? 2 : null,
        stingInput: stingFile ? (hasBgm ? 3 : 2) : null,
        totalDuration,
        turnAt,
      })}`,
      '-map', '[vout]',
      '-map', '[aout]',
      '-t', totalDuration.toFixed(3),
      '-c:v', 'libx264', '-preset', PRESET, '-crf', CRF, '-pix_fmt', 'yuv420p',
      '-profile:v', 'high', '-level', '4.1', '-r', String(FPS),
      '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2',
      '-movflags', '+faststart',
      outFile,
    ]
    await ffmpeg(args)

    const buf = await fs.readFile(outFile)
    const finalDuration = await probeDuration(outFile)
    return {
      buffer: buf,
      meta: {
        durationSec: Number(finalDuration.toFixed(2)),
        voiceoverSec: Number(voDuration.toFixed(2)),
        shots: shots.length,
        motionShots: shots.filter((s) => s.type === 'motion' && s.motionFile).length,
        bgm: hasBgm
          ? {
              mood: job.bgmMood,
              gainDb: BGM_GAIN_DB,
              ducking: 'sidechain',
              turnAtSec: turnAt == null ? null : Number(turnAt.toFixed(2)),
              sting: Boolean(stingFile),
            }
          : null,
        subtitlesBurned: BURN_SUBTITLES,
        resolution: `${W}x${H}`,
        fps: FPS,
        loudnessTargetLufs: LOUDNESS_LUFS,
      },
      cleanup: () => fs.rm(dir, { recursive: true, force: true }),
    }
  } catch (e) {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {})
    throw e
  }
}
