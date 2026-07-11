export interface Capability {
  title: string
  desc: string
  hint?: string
  stopLabel?: string
  urlMatch: RegExp
  urlHint: string
}

export interface Platform {
  label: string
  comingSoon?: boolean
  capability: Capability
}

export const PLATFORMS: Record<string, Platform> = {
  peerlist: {
    label: 'Peerlist',
    capability: {
      title: 'Auto Upvote Launch',
      desc: 'Open any launch project on Peerlist, then click Start. It upvotes each project and clicks Next, pausing like a human. Stop exports a CSV of everything upvoted.',
      hint: 'Tip: open a project popup first, e.g. from the weekly launchpad list.',
      urlMatch: /^https:\/\/peerlist\.io\//,
      urlHint: 'Open peerlist.io and a launch project, then reopen this popup.',
    },
  },
  linkedin: {
    label: 'LinkedIn',
    capability: {
      title: 'Auto Post Liker',
      desc: 'Scans a LinkedIn content search page and likes posts from people whose headline matches your keyword list. Capped at 6 likes/min.',
      hint: 'Tip: use a keyword-filtered content search, e.g. linkedin.com/search/results/content/?sortBy=date_posted',
      stopLabel: 'Stop',
      urlMatch: /^https:\/\/www\.linkedin\.com\//,
      urlHint: 'Open a LinkedIn page, then reopen this popup.',
    },
  },
  f6s: {
    label: 'F6S',
    comingSoon: true,
    capability: {
      title: 'Coming Soon',
      desc: 'F6S automation is under development.',
      urlMatch: /^https:\/\/www\.f6s\.com\//,
      urlHint: '',
    },
  },
}
