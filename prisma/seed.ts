import { PrismaClient } from '@prisma/client'
import { SERIES, TOPICS } from './seed-data/topics'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding series...')
  const seriesBySlug = new Map<string, string>()
  for (const s of SERIES) {
    const row = await prisma.series.upsert({
      where: { slug: s.slug },
      update: { name: s.name, description: s.description },
      create: { slug: s.slug, name: s.name, description: s.description },
    })
    seriesBySlug.set(s.slug, row.id)
  }

  console.log(`Seeding ${TOPICS.length} topics...`)
  let created = 0
  for (const t of TOPICS) {
    const exists = await prisma.topic.findFirst({ where: { title: t.title } })
    if (exists) continue
    await prisma.topic.create({
      data: {
        title: t.title,
        hook: t.hook,
        category: t.category,
        region: t.region,
        seriesId: t.seriesSlug ? seriesBySlug.get(t.seriesSlug) : undefined,
        source: 'seed',
        status: 'idea',
      },
    })
    created++
  }
  console.log(`Done. Series: ${SERIES.length}, topics created: ${created} (skipped ${TOPICS.length - created} existing).`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
