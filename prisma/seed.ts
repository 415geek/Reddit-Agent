import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const sources = [
  // National / Industry
  { sourceName: 'Restaurant Owners', subreddit: 'restaurantowners', rssUrl: 'https://www.reddit.com/r/restaurantowners/new/.rss', sourceType: 'national', priority: 10 },
  { sourceName: 'Restaurateur', subreddit: 'restaurateur', rssUrl: 'https://www.reddit.com/r/restaurateur/new/.rss', sourceType: 'national', priority: 10 },
  { sourceName: 'Small Business', subreddit: 'smallbusiness', rssUrl: 'https://www.reddit.com/r/smallbusiness/new/.rss', sourceType: 'industry', priority: 8 },
  { sourceName: 'Restaurants', subreddit: 'restaurants', rssUrl: 'https://www.reddit.com/r/restaurants/new/.rss', sourceType: 'national', priority: 9 },
  { sourceName: 'Entrepreneur', subreddit: 'Entrepreneur', rssUrl: 'https://www.reddit.com/r/Entrepreneur/new/.rss', sourceType: 'industry', priority: 7 },

  // Bay Area
  { sourceName: 'San Francisco', subreddit: 'sanfrancisco', rssUrl: 'https://www.reddit.com/r/sanfrancisco/new/.rss', sourceType: 'city', city: 'San Francisco', state: 'CA', region: 'Bay Area', priority: 9 },
  { sourceName: 'Bay Area', subreddit: 'bayarea', rssUrl: 'https://www.reddit.com/r/bayarea/new/.rss', sourceType: 'city', city: 'Bay Area', state: 'CA', region: 'Bay Area', priority: 9 },
  { sourceName: 'Ask SF', subreddit: 'AskSF', rssUrl: 'https://www.reddit.com/r/AskSF/new/.rss', sourceType: 'city', city: 'San Francisco', state: 'CA', region: 'Bay Area', priority: 7 },

  // Major Cities
  { sourceName: 'NYC', subreddit: 'nyc', rssUrl: 'https://www.reddit.com/r/nyc/new/.rss', sourceType: 'city', city: 'New York', state: 'NY', region: 'Northeast', priority: 9 },
  { sourceName: 'Ask NYC', subreddit: 'AskNYC', rssUrl: 'https://www.reddit.com/r/AskNYC/new/.rss', sourceType: 'city', city: 'New York', state: 'NY', region: 'Northeast', priority: 7 },
  { sourceName: 'Los Angeles', subreddit: 'LosAngeles', rssUrl: 'https://www.reddit.com/r/LosAngeles/new/.rss', sourceType: 'city', city: 'Los Angeles', state: 'CA', region: 'West', priority: 9 },
  { sourceName: 'Chicago', subreddit: 'chicago', rssUrl: 'https://www.reddit.com/r/chicago/new/.rss', sourceType: 'city', city: 'Chicago', state: 'IL', region: 'Midwest', priority: 8 },
  { sourceName: 'Houston', subreddit: 'houston', rssUrl: 'https://www.reddit.com/r/houston/new/.rss', sourceType: 'city', city: 'Houston', state: 'TX', region: 'South', priority: 8 },
  { sourceName: 'Dallas', subreddit: 'Dallas', rssUrl: 'https://www.reddit.com/r/Dallas/new/.rss', sourceType: 'city', city: 'Dallas', state: 'TX', region: 'South', priority: 8 },
  { sourceName: 'Austin', subreddit: 'Austin', rssUrl: 'https://www.reddit.com/r/Austin/new/.rss', sourceType: 'city', city: 'Austin', state: 'TX', region: 'South', priority: 8 },
  { sourceName: 'Seattle', subreddit: 'Seattle', rssUrl: 'https://www.reddit.com/r/Seattle/new/.rss', sourceType: 'city', city: 'Seattle', state: 'WA', region: 'West', priority: 8 },
  { sourceName: 'Boston', subreddit: 'boston', rssUrl: 'https://www.reddit.com/r/boston/new/.rss', sourceType: 'city', city: 'Boston', state: 'MA', region: 'Northeast', priority: 7 },
  { sourceName: 'Miami', subreddit: 'Miami', rssUrl: 'https://www.reddit.com/r/Miami/new/.rss', sourceType: 'city', city: 'Miami', state: 'FL', region: 'South', priority: 8 },
  { sourceName: 'Atlanta', subreddit: 'Atlanta', rssUrl: 'https://www.reddit.com/r/Atlanta/new/.rss', sourceType: 'city', city: 'Atlanta', state: 'GA', region: 'South', priority: 7 },
  { sourceName: 'Las Vegas', subreddit: 'vegas', rssUrl: 'https://www.reddit.com/r/vegas/new/.rss', sourceType: 'city', city: 'Las Vegas', state: 'NV', region: 'West', priority: 7 },
  { sourceName: 'Las Vegas r2', subreddit: 'LasVegas', rssUrl: 'https://www.reddit.com/r/LasVegas/new/.rss', sourceType: 'city', city: 'Las Vegas', state: 'NV', region: 'West', priority: 6 },
  { sourceName: 'Philadelphia', subreddit: 'philadelphia', rssUrl: 'https://www.reddit.com/r/philadelphia/new/.rss', sourceType: 'city', city: 'Philadelphia', state: 'PA', region: 'Northeast', priority: 7 },
  { sourceName: 'Washington DC', subreddit: 'washingtondc', rssUrl: 'https://www.reddit.com/r/washingtondc/new/.rss', sourceType: 'city', city: 'Washington DC', state: 'DC', region: 'Northeast', priority: 7 },
  { sourceName: 'San Diego', subreddit: 'sandiego', rssUrl: 'https://www.reddit.com/r/sandiego/new/.rss', sourceType: 'city', city: 'San Diego', state: 'CA', region: 'West', priority: 7 },
  { sourceName: 'Phoenix', subreddit: 'phoenix', rssUrl: 'https://www.reddit.com/r/phoenix/new/.rss', sourceType: 'city', city: 'Phoenix', state: 'AZ', region: 'West', priority: 7 },
  { sourceName: 'Denver', subreddit: 'Denver', rssUrl: 'https://www.reddit.com/r/Denver/new/.rss', sourceType: 'city', city: 'Denver', state: 'CO', region: 'West', priority: 7 },
  { sourceName: 'Portland', subreddit: 'Portland', rssUrl: 'https://www.reddit.com/r/Portland/new/.rss', sourceType: 'city', city: 'Portland', state: 'OR', region: 'West', priority: 6 },
  { sourceName: 'Orange County', subreddit: 'orangecounty', rssUrl: 'https://www.reddit.com/r/orangecounty/new/.rss', sourceType: 'city', city: 'Orange County', state: 'CA', region: 'West', priority: 7 },
]

async function main() {
  console.log('Seeding Reddit sources...')

  for (const source of sources) {
    await prisma.marketvoiceSource.upsert({
      where: { id: source.subreddit },
      update: source,
      create: { id: source.subreddit, ...source },
    })
  }

  console.log(`Seeded ${sources.length} Reddit sources`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
