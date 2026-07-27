import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { ffmpeg, ffmpegStderr, probeDuration } from './ffmpeg.mjs'
import { buildAss } from './subtitles.mjs'

const W = 1080
const H = 1920
const FPS = 30

/**
 * 讲述段 BGM 比旁白低多少 dB。
 * 参考视频用 demucs 拆成人声/伴奏两轨分别测,讲述段人声比伴奏高 13.3 dB。
 * 先设的 -13,拿同样的尺子量自己的成片只做到 +10.9,还差 2.4 dB,所以补到 -15。
 * (之前的 -20 明显太轻,音乐几乎不存在。)
 */
const BGM_GAIN_DB = Number(process.env.BGM_GAIN_DB || -15)
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

const FIT = `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},fps=${FPS},setsar=1,format=yuv420p`

/**
 * 把短片段做成"来回播"的回文片段:正着一遍再倒着一遍。
 *
 * 为什么要这个:图生视频按秒计费,5 秒比 9 秒便宜一半,所以片段常常比镜头短。
 * 补齐的老办法是冻住最后一帧,那一停很难看;直接首尾相接循环则会在接缝处跳一下。
 * 回文没有接缝——慢推进倒过来就是慢拉远,本来就是顺的。
 */
async function makePingPong(src, outFile) {
  await ffmpeg([
    '-i', src,
    '-filter_complex', `[0:v]${FIT},split[a][b];[b]reverse[r];[a][r]concat=n=2:v=1:a=0[v]`,
    '-map', '[v]', '-an',
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p',
    '-r', String(FPS),
    outFile,
  ])
  return outFile
}

async function renderSegment(shot, outFile, workDir) {
  const dur = shot.scaledDuration.toFixed(3)
  if (shot.type === 'motion' && shot.motionFile) {
    const clipDur = await probeDuration(shot.motionFile)
    // 片段比镜头短:先做成回文再无缝循环补满。长就直接切。
    if (clipDur > 0 && clipDur < shot.scaledDuration - 0.05) {
      const pp = await makePingPong(shot.motionFile, path.join(workDir, `pp_${shot.idx}.mp4`))
      await ffmpeg([
        '-stream_loop', '-1', '-i', pp,
        '-t', dur,
        '-vf', `fps=${FPS},setsar=1,format=yuv420p`,
        '-an',
        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p',
        '-r', String(FPS),
        outFile,
      ])
      return
    }
    await ffmpeg([
      '-i', shot.motionFile,
      '-t', dur,
      '-vf', FIT,
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
 * 反转点之后音乐冲多高、保持多久。参考视频实测——把五条伴奏 stem 相加,
 * 按 0.2 秒一格取**中位数**(不能用整段 RMS,见下面 TURN_DIP_FLOOR 那段的教训):
 *   铺垫段  伴奏 -30.4 dB
 *   炸点后  伴奏 -15.2 dB —— 比铺垫段高 15.2 dB,而且不退回去
 *   高能段持续 5.2 秒,再用约 3.3 秒衰减回原位
 * 这里默认 +15 dB,保持 5 秒,衰减 3.5 秒。
 */
const TURN_BOOST_DB = Number(process.env.TURN_BOOST_DB || 15)
const TURN_HIGH_SEC = Number(process.env.TURN_HIGH_SEC || 5)
const TURN_DECAY_SEC = Number(process.env.TURN_DECAY_SEC || 3.5)

/**
 * 反转点的音量包络:憋 → 砸 → 保持 → 回落。
 *
 * 这一条是整段音频设计的骨架。参考视频里:讲到揭晓前音乐先掉下去憋住,
 * 然后 50 毫秒内跳升 27 dB(低音先进、鼓 50ms 后跟上),
 * 之后音乐不退回去,一直压着人声响 5 秒,再慢慢衰减。
 *
 * 用 volume 的时间表达式而不是串 afade——afade=t=in 会把 st 之前的全部变成静音,
 * 串在中间等于把前半条曲子抹掉。
 */
function turnEnvelope(turnAt) {
  if (!TURN_STING || turnAt == null) return null

  const boost = Math.pow(10, TURN_BOOST_DB / 20)
  const dipStart = Math.max(0.3, turnAt - TURN_DIP_SEC)
  const ramp = 0.25 // 滑下去用多久
  // 坑底降约 6.7 dB,而且落到底之后还在慢慢往下滑,不是平的。
  //
  // 这个数我量错过两次,记一下免得再错:
  // 第一次按"近乎静音"(-23 dB)挖,炸点落差 +61 dB,比参考的 +29 猛一倍。
  // 第二次纠枉过正改成 -3 dB,依据是 demucs 拆出来的伴奏在憋气段只比铺垫段低 2.9 dB。
  // 那个 2.9 是假的:憋气段开头 20.4s 有一下 -22.9 dB 的瞬态,整段取 RMS 时被它一个人
  // 拉高了 5 dB。改成按 0.2 秒一格取中位数,真实值是铺垫 -30.4 / 憋气 -37.1,
  // 也就是 -6.7 dB;而且最后一秒还从 -34.9 一路滑到 -38.8。
  // 教训:量一段有瞬态的电平不能用整段 RMS,RMS 只反映最响的那一下。
  const floor = Number(process.env.TURN_DIP_FLOOR || 0.462)
  // 坑底继续下滑到多少(参考视频最后一秒又掉了 3.9 dB)。憋住的感觉来自这个"还在退",
  // 平着托住反而像音乐只是小声了一点。
  const sink = (floor * Math.pow(10, -3.9 / 20)).toFixed(4)
  const slam = 0.05 // 砸上去的时间,对齐参考视频实测的 50 毫秒

  const a = dipStart.toFixed(3)
  const b = (dipStart + ramp).toFixed(3)
  const c = turnAt.toFixed(3)
  const d = (turnAt + slam).toFixed(3)
  const e = (turnAt + slam + TURN_HIGH_SEC).toFixed(3)
  const f = (turnAt + slam + TURN_HIGH_SEC + TURN_DECAY_SEC).toFixed(3)
  const B = boost.toFixed(4)

  // 坑底那段有多长(滑到底之后到炸点之间)。TURN_DIP_SEC 小于 ramp 时可能为零,兜一下
  const hold = Math.max(0.001, turnAt - (dipStart + ramp))

  return (
    `if(lt(t,${a}),1,` + // 正常
    `if(lt(t,${b}),1-(1-${floor})*(t-${a})/${ramp},` + // 滑下去
    `if(lt(t,${c}),${floor}-(${floor}-${sink})*(t-${b})/${hold.toFixed(3)},` + // 憋住,并继续慢慢退
    `if(lt(t,${d}),${sink}+(${B}-${sink})*(t-${c})/${slam},` + // 砸上去(50ms)
    `if(lt(t,${e}),${B},` + // 高能保持
    `if(lt(t,${f}),${B}-(${B}-1)*(t-${e})/${TURN_DECAY_SEC},1))))))` // 衰减回原位
  )
}

/**
 * 反转点那个"停顿"要多长。参考视频停了 5.6 秒,但那是一条 32 秒的片子;
 * 一百多秒的片子挖 5 秒空洞太赌完播率了,1.6 秒足够让人抬头。
 */
const TURN_GAP_SEC = Number(process.env.TURN_GAP_SEC || 1.6)
/** 撞击落在停顿的第几秒。参考视频是停顿开始后约 3.4 秒砸下来,音乐先响、人声后回 */
const TURN_SLAM_INTO_GAP = Number(process.env.TURN_SLAM_INTO_GAP || 1.05)

/** 列出配音里所有的停顿 */
async function detectPauses(voFile) {
  const out = await ffmpegStderr([
    '-v', 'info', '-i', voFile, '-af', 'silencedetect=n=-38dB:d=0.25', '-f', 'null', '-',
  ])
  const pauses = []
  let start = null
  for (const m of out.matchAll(/silence_(start|end): ([\d.]+)/g)) {
    if (m[1] === 'start') start = Number(m[2])
    else if (start != null) {
      pauses.push({ start, end: Number(m[2]) })
      start = null
    }
  }
  return pauses
}

/**
 * 在配音里给反转点凿出一个真正的停顿,并返回撞击应该落在第几秒。
 *
 * 这一步是整个反转音效能不能成立的前提。之前把撞击对齐到"第 N 个镜头的开头",
 * 结果它落在半句话中间——旁白一直在说,音乐怎么憋、怎么砸都听不出来,
 * 前面调的那些 dB 全是白调的。参考视频之所以有劲,是因为那三秒**人声是停的**。
 *
 * 做法:在名义反转点附近找一个现成的句间停顿(TTS 本来就会留半秒),
 * 把它接长到 TURN_GAP_SEC,撞击落在停顿中间——音乐先炸,人声隔一会儿才回来。
 */
async function carveTurnGap(voFile, nominalAt, outFile, log) {
  const pauses = await detectPauses(voFile)
  if (!pauses.length) {
    log('配音里找不到任何停顿,反转点只能按镜头对齐')
    return null
  }
  // 只在名义反转点前后 6 秒里找,太远了对不上画面
  const near = pauses.filter((p) => Math.abs(p.start - nominalAt) <= 6)
  const pool = near.length ? near : pauses
  const gap = pool.reduce((best, p) =>
    Math.abs(p.start - nominalAt) < Math.abs(best.start - nominalAt) ? p : best)

  const have = gap.end - gap.start
  const need = Math.max(0, TURN_GAP_SEC - have)
  // 撞击落在停顿里靠前的位置:音乐先炸,人声隔一会儿才回来
  const slamAt = gap.start + Math.min(TURN_SLAM_INTO_GAP, (have + need) * 0.65)

  if (need < 0.05) {
    log(`反转点对齐到配音第 ${gap.start.toFixed(1)}s 的停顿(已有 ${have.toFixed(2)}s,不用加长)`)
    return { voFile, slamAt, added: 0 }
  }

  // 从停顿正中切开,塞进一段静音。不能用 apad——它只会加在结尾
  const mid = (gap.start + gap.end) / 2
  const d = path.dirname(outFile)
  const head = path.join(d, 'vo_head.wav')
  const tail = path.join(d, 'vo_tail.wav')
  const pad = path.join(d, 'vo_pad.wav')
  await ffmpeg(['-v', 'error', '-i', voFile, '-t', mid.toFixed(3), '-ac', '1', '-ar', '48000', head])
  await ffmpeg(['-v', 'error', '-ss', mid.toFixed(3), '-i', voFile, '-ac', '1', '-ar', '48000', tail])
  await ffmpeg(['-v', 'error', '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=mono', '-t', need.toFixed(3), pad])
  await ffmpeg(['-v', 'error', '-i', head, '-i', pad, '-i', tail,
    '-filter_complex', '[0:a][1:a][2:a]concat=n=3:v=0:a=1[a]', '-map', '[a]', '-ar', '48000', outFile])

  // slamAt 不用再修正:静音是从 mid 插进去的,而 gap.start < mid,
  // 停顿开头在新旧时间轴上是同一个数
  log(`反转点对齐到配音第 ${gap.start.toFixed(1)}s 的停顿,补了 ${need.toFixed(2)}s 静音凑够 ${TURN_GAP_SEC}s`)
  return { voFile: outFile, slamAt, added: need }
}

/**
 * 侧链钥匙的包络:高能段把钥匙压小,音乐就不闪避了。
 * 注意这里改的是**送去做检测的那一路**,不是听得到的旁白——旁白走的是 vo_main。
 */
function keyEnvelope(turnAt) {
  const env = turnEnvelope(turnAt)
  if (!env) return `[vo_key0]anull[vo_key]`
  const s = turnAt.toFixed(3)
  const e = (turnAt + TURN_HIGH_SEC).toFixed(3)
  const f = (turnAt + TURN_HIGH_SEC + TURN_DECAY_SEC).toFixed(3)
  const k = Number(process.env.TURN_KEY_DUCK || 0.18).toFixed(3)
  return (
    `[vo_key0]volume=volume='` +
    `if(lt(t,${s}),1,` +
    `if(lt(t,${e}),${k},` +
    `if(lt(t,${f}),${k}+(1-${k})*(t-${e})/${TURN_DECAY_SEC},1)))` +
    `':eval=frame[vo_key]`
  )
}

/** 全曲的淡入淡出(和反转包络分开:那个要在闪避之后才乘上去) */
function bgmFades(totalDuration) {
  const fadeOutStart = Math.max(0, totalDuration - 2.5).toFixed(3)
  return `afade=t=in:st=0:d=1.5,afade=t=out:st=${fadeOutStart}:d=2.5`
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
    `[vo]asplit=2[vo_main][vo_key0]`,
    // 炸点之后先把侧链的"钥匙"压小,让音乐在高能段不给人声让路。
    // 只把包络乘在闪避之后是不够的:人声一回来,侧链照样把音乐按下去,
    // 实测高能段中位比参考低了 2.8 dB,而且是一路往下掉,不是参考那种平着压住。
    // 参考视频里炸点之后音乐是盖着人声响完 5 秒的,所以要从源头少闪避。
    keyEnvelope(turnAt),
    // BGM 比成片短就循环补齐,长就裁掉
    // 高切:把 BGM 的低频让出来。男声基频在 120Hz 上下,撞击在 40-90Hz,
    // 音乐再占着这一段就会糊成一片。参考视频的音乐低频只占 29%,
    // 而生成的曲子普遍在 45-57%——不切的话压在旁白下面是闷的。
    `[${bgmInput}:a]aresample=48000,aloop=loop=-1:size=2147483647,atrim=0:${totalDuration.toFixed(3)},asetpts=N/SR/TB,` +
      `highpass=f=${BGM_HIGHPASS_HZ}:poles=2,` +
      `volume=${BGM_GAIN_DB}dB,${bgmFades(totalDuration)}[bgm]`,
    `[bgm][vo_key]sidechaincompress=threshold=0.03:ratio=12:attack=25:release=350:makeup=1[bgm_ducked]`,
  ]

  // 反转包络必须乘在闪避之后。放在前面的话,高能段那 +12 dB 会被侧链压回去,
  // 而参考视频里恰恰相反:炸点之后音乐一直压着人声响,不让路。
  const env = turnEnvelope(turnAt)
  if (env) {
    parts.push(`[bgm_ducked]volume=volume='${env}':eval=frame[bgm_final]`)
  } else {
    parts.push(`[bgm_ducked]anull[bgm_final]`)
  }

  if (stingInput != null && turnAt != null) {
    // 撞击垫到反转点上。它不进侧链——这一下就是要盖过一切,让人抬头
    parts.push(`[${stingInput}:a]aresample=48000,adelay=${Math.round(turnAt * 1000)}|${Math.round(turnAt * 1000)}[sting]`)
    parts.push(`[vo_main][bgm_final][sting]amix=inputs=3:duration=first:normalize=0[mix]`)
  } else {
    parts.push(`[vo_main][bgm_final]amix=inputs=2:duration=first:normalize=0[mix]`)
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
  // 低音扫频:90Hz 滑到 40Hz。相位是频率的积分,所以是 t - t² 那一项
  const sub = `0.9*exp(-3*t)*sin(2*PI*(90*t-20.8*t*t))`
  // 鼓的瞬态:一小撮宽频噪声,衰减极快。
  // 参考视频实测炸点是"低音先进、50ms 后鼓跟上",光有低音只闷响一声、不够抓耳;
  // 中高频那一下才是让人抬头的东西。
  const hit = `0.5*exp(-26*t)*(random(0)*2-1)`
  await ffmpeg([
    '-f', 'lavfi', '-i', `aevalsrc=${sub}:s=48000:d=${dur}`,
    '-f', 'lavfi', '-i', `aevalsrc=${hit}:s=48000:d=${dur}`,
    '-filter_complex',
      `[0:a]lowpass=f=160[low];` +
      // 鼓延后 50ms,和参考视频的进入顺序对齐;带通掉极低频免得和低音打架
      `[1:a]highpass=f=200,lowpass=f=6000,adelay=50|50[snap];` +
      `[low][snap]amix=inputs=2:duration=first:normalize=0,` +
      `afade=t=out:st=0.9:d=0.3,alimiter=limit=0.95[out]`,
    '-map', '[out]',
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
    let voFile = files.voiceover
    if (!voFile) throw new Error('没有配音文件,无法合成')

    // 1.5 先在配音里凿出反转点的停顿。必须赶在算镜头时长之前——
    //     插静音会把配音变长,镜头缩放是按配音长度算的。
    const hasBgm0 = Boolean(files.bgm)
    let slamAt = null
    if (hasBgm0 && TURN_STING && job.turnShotIdx != null) {
      const rawTotal0 = job.shots.reduce((s, sh) => s + (sh.durationSec || 0), 0)
      const rawTurn = job.shots
        .filter((sh) => sh.idx < job.turnShotIdx)
        .reduce((s, sh) => s + (sh.durationSec || 0), 0)
      const voDur0 = await probeDuration(voFile)
      // 分镜时长是模型估的,只用它的比例去配音里定位,不用它的绝对值
      const nominalAt = rawTotal0 > 0 ? (rawTurn / rawTotal0) * voDur0 : voDur0 / 2
      const carved = await carveTurnGap(voFile, nominalAt, path.join(dir, 'voiceover_gap.wav'), log)
      if (carved) {
        voFile = carved.voFile
        slamAt = carved.slamAt
      }
    }

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
    let totalDuration = t

    // 让反转那一刀正好切在撞击上。撞击是按配音里的停顿定的,画面要跟着它走,
    // 不能反过来——差个一秒,听到的和看到的就对不上,那一下就废了。
    // 做法是把前半段压到 slamAt 结束、后半段撑满剩下的,总时长不变。
    const turnPos = shots.findIndex((sh) => sh.idx === job.turnShotIdx)
    if (slamAt != null && turnPos > 0 && slamAt > 1 && slamAt < totalDuration - 1) {
      const before = shots.slice(0, turnPos).reduce((s, sh) => s + sh.scaledDuration, 0)
      const after = totalDuration - before
      const kBefore = slamAt / before
      const kAfter = (totalDuration - slamAt) / after
      let c = 0
      shots.forEach((sh, i) => {
        sh.scaledDuration = Math.max(1.0, sh.scaledDuration * (i < turnPos ? kBefore : kAfter))
        sh.startSec = c
        c += sh.scaledDuration
      })
      totalDuration = c
      log(`画面切点对齐到撞击:第 ${turnPos} 个镜头起于 ${shots[turnPos].startSec.toFixed(2)}s`)
    }
    log(`配音 ${voDuration.toFixed(1)}s → 成片 ${totalDuration.toFixed(1)}s,${shots.length} 个镜头`)

    // 3. 逐镜头渲染
    const segDir = path.join(dir, 'seg')
    await fs.mkdir(segDir, { recursive: true })
    const segments = []
    for (const sh of shots) {
      const out = path.join(segDir, `seg_${String(sh.idx).padStart(3, '0')}.mp4`)
      await renderSegment(sh, out, segDir)
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

    // 反转点落在哪一秒:优先用配音里量出来的停顿位置(音画已经对齐到它了),
    // 没量到就退回分镜标的下标,再没有就当没标
    const turnShot = job.turnShotIdx == null ? null : shots.find((sh) => sh.idx === job.turnShotIdx)
    const turnAt = slamAt ?? (turnShot ? turnShot.startSec : null)
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
