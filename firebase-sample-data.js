// Firebase Sample Data Generator
// Run this script to populate your Firestore with sample data

// Sample data structure for the Dozlo app
const sampleData = {
  categories: [
    {
      id: 'meditation',
      name: 'Meditation',
      sections: ['featured-meditation', 'sleep-meditation', 'stress-relief']
    },
    {
      id: 'sleep',
      name: 'Sleep',
      sections: ['bedtime-stories', 'sleep-sounds', 'relaxation']
    },
    {
      id: 'focus',
      name: 'Focus',
      sections: ['productivity', 'concentration', 'work-music']
    }
  ],
  
  sections: [
    {
      id: 'featured-meditation',
      title: 'Featured Meditation',
      sectionName: 'Featured Meditation',
      sectionType: 'sliderCards',
      stories: ['meditation-1', 'meditation-2', 'meditation-3']
    },
    {
      id: 'sleep-meditation',
      title: 'Sleep Meditation',
      sectionName: 'Sleep Meditation',
      sectionType: 'cards',
      stories: ['sleep-1', 'sleep-2', 'sleep-3', 'sleep-4']
    },
    {
      id: 'stress-relief',
      title: 'Stress Relief',
      sectionName: 'Stress Relief',
      sectionType: 'stacks',
      stories: ['stress-1', 'stress-2', 'stress-3']
    },
    {
      id: 'bedtime-stories',
      title: 'Bedtime Stories',
      sectionName: 'Bedtime Stories',
      sectionType: 'cards',
      stories: ['story-1', 'story-2', 'story-3', 'story-4', 'story-5']
    },
    {
      id: 'sleep-sounds',
      title: 'Sleep Sounds',
      sectionName: 'Sleep Sounds',
      sectionType: 'sliderCards',
      stories: ['rain-sounds', 'ocean-sounds', 'forest-sounds']
    },
    {
      id: 'relaxation',
      title: 'Relaxation',
      sectionName: 'Relaxation',
      sectionType: 'cards',
      stories: ['relax-1', 'relax-2', 'relax-3']
    },
    {
      id: 'productivity',
      title: 'Productivity',
      sectionName: 'Productivity',
      sectionType: 'cards',
      stories: ['focus-1', 'focus-2', 'focus-3']
    },
    {
      id: 'concentration',
      title: 'Concentration',
      sectionName: 'Concentration',
      sectionType: 'stacks',
      stories: ['concentrate-1', 'concentrate-2']
    },
    {
      id: 'work-music',
      title: 'Work Music',
      sectionName: 'Work Music',
      sectionType: 'sliderCards',
      stories: ['work-1', 'work-2', 'work-3']
    }
  ],
  
  stories: [
    {
      id: 'meditation-1',
      title: 'Morning Meditation',
      subTitle: 'Start your day with peace and clarity',
      imageUrl: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=300&fit=crop',
      audioUrl: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.wav',
      r2Path: 'meditation/morning-meditation.mp3',
      duration: 600,
      narratorName: 'Sarah Johnson',
      createdAt: new Date('2024-01-15'),
      updatedAt: new Date('2024-01-15')
    },
    {
      id: 'meditation-2',
      title: 'Mindful Breathing',
      subTitle: 'Deep breathing exercises for relaxation',
      imageUrl: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=400&h=300&fit=crop',
      audioUrl: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.wav',
      r2Path: 'meditation/mindful-breathing.mp3',
      duration: 480,
      narratorName: 'Michael Chen',
      createdAt: new Date('2024-01-16'),
      updatedAt: new Date('2024-01-16')
    },
    {
      id: 'meditation-3',
      title: 'Body Scan',
      subTitle: 'Progressive relaxation technique',
      imageUrl: 'https://images.unsplash.com/photo-1518241353330-0f7941c2d9b5?w=400&h=300&fit=crop',
      audioUrl: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.wav',
      r2Path: 'meditation/body-scan.mp3',
      duration: 900,
      narratorName: 'Emma Davis',
      createdAt: new Date('2024-01-17'),
      updatedAt: new Date('2024-01-17')
    },
    {
      id: 'sleep-1',
      title: 'Deep Sleep',
      subTitle: 'Guided meditation for better sleep',
      imageUrl: 'https://images.unsplash.com/photo-1513002749550-c59d786b8e6c?w=400&h=300&fit=crop',
      audioUrl: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.wav',
      r2Path: 'sleep/deep-sleep.mp3',
      duration: 1200,
      narratorName: 'David Wilson',
      createdAt: new Date('2024-01-18'),
      updatedAt: new Date('2024-01-18')
    },
    {
      id: 'sleep-2',
      title: 'Sleep Stories',
      subTitle: 'Peaceful narratives for bedtime',
      imageUrl: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=300&fit=crop',
      audioUrl: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.wav',
      r2Path: 'sleep/sleep-stories.mp3',
      duration: 1800,
      narratorName: 'Lisa Brown',
      createdAt: new Date('2024-01-19'),
      updatedAt: new Date('2024-01-19')
    },
    {
      id: 'sleep-3',
      title: 'Calm Mind',
      subTitle: 'Quiet your thoughts before sleep',
      imageUrl: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=400&h=300&fit=crop',
      audioUrl: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.wav',
      r2Path: 'sleep/calm-mind.mp3',
      duration: 900,
      narratorName: 'James Miller',
      createdAt: new Date('2024-01-20'),
      updatedAt: new Date('2024-01-20')
    },
    {
      id: 'sleep-4',
      title: 'Night Relaxation',
      subTitle: 'Evening wind-down routine',
      imageUrl: 'https://images.unsplash.com/photo-1518241353330-0f7941c2d9b5?w=400&h=300&fit=crop',
      audioUrl: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.wav',
      r2Path: 'sleep/night-relaxation.mp3',
      duration: 600,
      narratorName: 'Anna Garcia',
      createdAt: new Date('2024-01-21'),
      updatedAt: new Date('2024-01-21')
    },
    {
      id: 'stress-1',
      title: 'Stress Relief',
      subTitle: 'Release tension and anxiety',
      imageUrl: 'https://images.unsplash.com/photo-1513002749550-c59d786b8e6c?w=400&h=300&fit=crop',
      audioUrl: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.wav',
      r2Path: 'stress/stress-relief.mp3',
      duration: 720,
      narratorName: 'Robert Taylor',
      createdAt: new Date('2024-01-22'),
      updatedAt: new Date('2024-01-22')
    },
    {
      id: 'stress-2',
      title: 'Anxiety Relief',
      subTitle: 'Calm your nervous system',
      imageUrl: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=300&fit=crop',
      audioUrl: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.wav',
      r2Path: 'stress/anxiety-relief.mp3',
      duration: 600,
      narratorName: 'Maria Rodriguez',
      createdAt: new Date('2024-01-23'),
      updatedAt: new Date('2024-01-23')
    },
    {
      id: 'stress-3',
      title: 'Peaceful Mind',
      subTitle: 'Find inner peace and tranquility',
      imageUrl: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=400&h=300&fit=crop',
      audioUrl: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.wav',
      r2Path: 'stress/peaceful-mind.mp3',
      duration: 900,
      narratorName: 'Thomas Anderson',
      createdAt: new Date('2024-01-24'),
      updatedAt: new Date('2024-01-24')
    },
    {
      id: 'story-1',
      title: 'The Magic Forest',
      subTitle: 'A bedtime story for peaceful sleep',
      imageUrl: 'https://images.unsplash.com/photo-1518241353330-0f7941c2d9b5?w=400&h=300&fit=crop',
      audioUrl: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.wav',
      r2Path: 'stories/magic-forest.mp3',
      duration: 1500,
      narratorName: 'Sophie Williams',
      createdAt: new Date('2024-01-25'),
      updatedAt: new Date('2024-01-25')
    },
    {
      id: 'story-2',
      title: 'Ocean Dreams',
      subTitle: 'Drift away with ocean waves',
      imageUrl: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=300&fit=crop',
      audioUrl: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.wav',
      r2Path: 'stories/ocean-dreams.mp3',
      duration: 1200,
      narratorName: 'Daniel Lee',
      createdAt: new Date('2024-01-26'),
      updatedAt: new Date('2024-01-26')
    },
    {
      id: 'story-3',
      title: 'Starry Night',
      subTitle: 'A journey through the stars',
      imageUrl: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=400&h=300&fit=crop',
      audioUrl: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.wav',
      r2Path: 'stories/starry-night.mp3',
      duration: 1800,
      narratorName: 'Emily Clark',
      createdAt: new Date('2024-01-27'),
      updatedAt: new Date('2024-01-27')
    },
    {
      id: 'story-4',
      title: 'Mountain Serenity',
      subTitle: 'Peaceful mountain meditation',
      imageUrl: 'https://images.unsplash.com/photo-1518241353330-0f7941c2d9b5?w=400&h=300&fit=crop',
      audioUrl: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.wav',
      r2Path: 'stories/mountain-serenity.mp3',
      duration: 900,
      narratorName: 'Christopher White',
      createdAt: new Date('2024-01-28'),
      updatedAt: new Date('2024-01-28')
    },
    {
      id: 'story-5',
      title: 'Gentle Rain',
      subTitle: 'Soothing rain sounds for sleep',
      imageUrl: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=300&fit=crop',
      audioUrl: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.wav',
      r2Path: 'stories/gentle-rain.mp3',
      duration: 2400,
      narratorName: 'Amanda Foster',
      createdAt: new Date('2024-01-29'),
      updatedAt: new Date('2024-01-29')
    },
    {
      id: 'rain-sounds',
      title: 'Rain Sounds',
      subTitle: 'Natural rain for deep sleep',
      imageUrl: 'https://images.unsplash.com/photo-1513002749550-c59d786b8e6c?w=400&h=300&fit=crop',
      audioUrl: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.wav',
      r2Path: 'sounds/rain-sounds.mp3',
      duration: 3600,
      narratorName: 'Nature Sounds',
      createdAt: new Date('2024-01-30'),
      updatedAt: new Date('2024-01-30')
    },
    {
      id: 'ocean-sounds',
      title: 'Ocean Waves',
      subTitle: 'Calming ocean waves',
      imageUrl: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=400&h=300&fit=crop',
      audioUrl: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.wav',
      r2Path: 'sounds/ocean-waves.mp3',
      duration: 3600,
      narratorName: 'Nature Sounds',
      createdAt: new Date('2024-01-31'),
      updatedAt: new Date('2024-01-31')
    },
    {
      id: 'forest-sounds',
      title: 'Forest Ambience',
      subTitle: 'Peaceful forest sounds',
      imageUrl: 'https://images.unsplash.com/photo-1518241353330-0f7941c2d9b5?w=400&h=300&fit=crop',
      audioUrl: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.wav',
      r2Path: 'sounds/forest-ambience.mp3',
      duration: 3600,
      narratorName: 'Nature Sounds',
      createdAt: new Date('2024-02-01'),
      updatedAt: new Date('2024-02-01')
    },
    {
      id: 'relax-1',
      title: 'Deep Relaxation',
      subTitle: 'Complete body and mind relaxation',
      imageUrl: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=300&fit=crop',
      audioUrl: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.wav',
      r2Path: 'relaxation/deep-relaxation.mp3',
      duration: 1200,
      narratorName: 'Jennifer Hall',
      createdAt: new Date('2024-02-02'),
      updatedAt: new Date('2024-02-02')
    },
    {
      id: 'relax-2',
      title: 'Mindful Moments',
      subTitle: 'Present moment awareness',
      imageUrl: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=400&h=300&fit=crop',
      audioUrl: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.wav',
      r2Path: 'relaxation/mindful-moments.mp3',
      duration: 900,
      narratorName: 'Kevin Martinez',
      createdAt: new Date('2024-02-03'),
      updatedAt: new Date('2024-02-03')
    },
    {
      id: 'relax-3',
      title: 'Inner Peace',
      subTitle: 'Find your center of peace',
      imageUrl: 'https://images.unsplash.com/photo-1518241353330-0f7941c2d9b5?w=400&h=300&fit=crop',
      audioUrl: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.wav',
      r2Path: 'relaxation/inner-peace.mp3',
      duration: 1500,
      narratorName: 'Rachel Green',
      createdAt: new Date('2024-02-04'),
      updatedAt: new Date('2024-02-04')
    },
    {
      id: 'focus-1',
      title: 'Deep Focus',
      subTitle: 'Concentrate and get things done',
      imageUrl: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=300&fit=crop',
      audioUrl: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.wav',
      r2Path: 'productivity/deep-focus.mp3',
      duration: 1800,
      narratorName: 'Alex Thompson',
      createdAt: new Date('2024-02-05'),
      updatedAt: new Date('2024-02-05')
    },
    {
      id: 'focus-2',
      title: 'Work Flow',
      subTitle: 'Optimize your work rhythm',
      imageUrl: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=400&h=300&fit=crop',
      audioUrl: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.wav',
      r2Path: 'productivity/work-flow.mp3',
      duration: 2400,
      narratorName: 'Michelle Park',
      createdAt: new Date('2024-02-06'),
      updatedAt: new Date('2024-02-06')
    },
    {
      id: 'focus-3',
      title: 'Peak Performance',
      subTitle: 'Achieve your best work',
      imageUrl: 'https://images.unsplash.com/photo-1518241353330-0f7941c2d9b5?w=400&h=300&fit=crop',
      audioUrl: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.wav',
      r2Path: 'productivity/peak-performance.mp3',
      duration: 3000,
      narratorName: 'Ryan Johnson',
      createdAt: new Date('2024-02-07'),
      updatedAt: new Date('2024-02-07')
    },
    {
      id: 'concentrate-1',
      title: 'Study Focus',
      subTitle: 'Perfect for studying and learning',
      imageUrl: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=300&fit=crop',
      audioUrl: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.wav',
      r2Path: 'concentration/study-focus.mp3',
      duration: 3600,
      narratorName: 'Lisa Chen',
      createdAt: new Date('2024-02-08'),
      updatedAt: new Date('2024-02-08')
    },
    {
      id: 'concentrate-2',
      title: 'Mental Clarity',
      subTitle: 'Clear your mind for better thinking',
      imageUrl: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=400&h=300&fit=crop',
      audioUrl: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.wav',
      r2Path: 'concentration/mental-clarity.mp3',
      duration: 1800,
      narratorName: 'David Kim',
      createdAt: new Date('2024-02-09'),
      updatedAt: new Date('2024-02-09')
    },
    {
      id: 'work-1',
      title: 'Office Ambience',
      subTitle: 'Productive work environment sounds',
      imageUrl: 'https://images.unsplash.com/photo-1518241353330-0f7941c2d9b5?w=400&h=300&fit=crop',
      audioUrl: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.wav',
      r2Path: 'work/office-ambience.mp3',
      duration: 4800,
      narratorName: 'Work Sounds',
      createdAt: new Date('2024-02-10'),
      updatedAt: new Date('2024-02-10')
    },
    {
      id: 'work-2',
      title: 'Creative Flow',
      subTitle: 'Inspire your creative process',
      imageUrl: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=300&fit=crop',
      audioUrl: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.wav',
      r2Path: 'work/creative-flow.mp3',
      duration: 3600,
      narratorName: 'Creative Sounds',
      createdAt: new Date('2024-02-11'),
      updatedAt: new Date('2024-02-11')
    },
    {
      id: 'work-3',
      title: 'Productive Rhythm',
      subTitle: 'Find your optimal work rhythm',
      imageUrl: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=400&h=300&fit=crop',
      audioUrl: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.wav',
      r2Path: 'work/productive-rhythm.mp3',
      duration: 4200,
      narratorName: 'Productivity Sounds',
      createdAt: new Date('2024-02-12'),
      updatedAt: new Date('2024-02-12')
    }
  ]
};

// Legal and Informational Content Collections
// These collections will store dynamic content for legal pages and informational pages

// Collection: legal_content
const legalContentSample = {
  "privacy-policy": {
    "id": "privacy-policy",
    "title": "Privacy Policy",
    "lastUpdated": "2024-07-28",
    "sections": [
      {
        "id": "information-collection",
        "title": "1. Information We Collect",
        "content": "We collect information you provide directly to us, such as when you create an account, sign in, or contact us for support.",
        "subsections": [
          {
            "title": "This may include:",
            "type": "list",
            "items": [
              "Name and email address (when you sign in with Google)",
              "Profile information and preferences",
              "Usage data and listening history",
              "Device information and app performance data"
            ]
          }
        ]
      },
      {
        "id": "information-use",
        "title": "2. How We Use Your Information",
        "content": "We use the information we collect to:",
        "type": "list",
        "items": [
          "Provide, maintain, and improve our services",
          "Personalize your experience and content recommendations",
          "Process transactions and send related information",
          "Send technical notices and support messages",
          "Respond to your comments and questions"
        ]
      },
      {
        "id": "information-sharing",
        "title": "3. Information Sharing",
        "content": "We do not sell, trade, or otherwise transfer your personal information to third parties without your consent, except as described in this policy.",
        "subsections": [
          {
            "title": "We may share your information in the following circumstances:",
            "type": "list",
            "items": [
              "With your consent",
              "To comply with legal obligations",
              "To protect our rights and safety",
              "In connection with a business transfer"
            ]
          }
        ]
      },
      {
        "id": "data-security",
        "title": "4. Data Security",
        "content": "We implement appropriate security measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction. However, no method of transmission over the internet or electronic storage is 100% secure, so we cannot guarantee absolute security."
      },
      {
        "id": "your-rights",
        "title": "5. Your Rights",
        "content": "You have the right to:",
        "type": "list",
        "items": [
          "Access and update your personal information",
          "Delete your account and associated data",
          "Opt out of certain communications",
          "Request data portability"
        ]
      },
      {
        "id": "contact-us",
        "title": "6. Contact Us",
        "content": "If you have any questions about this Privacy Policy, please contact us at privacy@dozlo.com"
      }
    ]
  },
  "terms-of-use": {
    "id": "terms-of-use",
    "title": "Terms of Use",
    "lastUpdated": "2024-07-28",
    "sections": [
      {
        "id": "acceptance",
        "title": "1. Acceptance of Terms",
        "content": "By accessing and using the Dozlo app, you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to abide by the above, please do not use this service."
      },
      {
        "id": "use-license",
        "title": "2. Use License",
        "content": "Permission is granted to temporarily download one copy of the Dozlo app for personal, non-commercial transitory viewing only. This is the grant of a license, not a transfer of title, and under this license you may not:",
        "type": "list",
        "items": [
          "Modify or copy the materials",
          "Use the materials for any commercial purpose",
          "Attempt to reverse engineer any software contained in the app",
          "Remove any copyright or other proprietary notations",
          "Transfer the materials to another person"
        ]
      },
      {
        "id": "user-account",
        "title": "3. User Account",
        "content": "When you create an account with us, you must provide accurate and complete information. You are responsible for safeguarding the password and for all activities that occur under your account.",
        "subsections": [
          {
            "title": "You agree not to:",
            "type": "list",
            "items": [
              "Use another user's account without permission",
              "Create false or misleading information",
              "Interfere with or disrupt the service",
              "Attempt to gain unauthorized access to the service"
            ]
          }
        ]
      },
      {
        "id": "content-intellectual-property",
        "title": "4. Content and Intellectual Property",
        "content": "The content provided in the Dozlo app, including but not limited to audio stories, text, graphics, and software, is owned by Dozlo or its licensors and is protected by copyright and other intellectual property laws. You may not reproduce, distribute, or create derivative works from this content without express written permission."
      },
      {
        "id": "privacy-policy",
        "title": "5. Privacy Policy",
        "content": "Your privacy is important to us. Please review our Privacy Policy, which also governs your use of the service, to understand our practices."
      },
      {
        "id": "disclaimer",
        "title": "6. Disclaimer",
        "content": "The materials within the Dozlo app are provided on an 'as is' basis. Dozlo makes no warranties, expressed or implied, and hereby disclaims and negates all other warranties including without limitation, implied warranties or conditions of merchantability, fitness for a particular purpose, or non-infringement of intellectual property or other violation of rights."
      },
      {
        "id": "limitations",
        "title": "7. Limitations",
        "content": "In no event shall Dozlo or its suppliers be liable for any damages (including, without limitation, damages for loss of data or profit, or due to business interruption) arising out of the use or inability to use the materials on Dozlo's app."
      },
      {
        "id": "revisions-errata",
        "title": "8. Revisions and Errata",
        "content": "The materials appearing on Dozlo's app could include technical, typographical, or photographic errors. Dozlo does not warrant that any of the materials on its app are accurate, complete, or current."
      },
      {
        "id": "links",
        "title": "9. Links",
        "content": "Dozlo has not reviewed all of the sites linked to its app and is not responsible for the contents of any such linked site. The inclusion of any link does not imply endorsement by Dozlo of the site."
      },
      {
        "id": "modifications",
        "title": "10. Modifications",
        "content": "Dozlo may revise these terms of use for its app at any time without notice. By using this app, you are agreeing to be bound by the then current version of these Terms and Conditions of Use."
      },
      {
        "id": "contact-information",
        "title": "11. Contact Information",
        "content": "If you have any questions about these Terms of Use, please contact us at terms@dozlo.com"
      }
    ]
  }
};

// Collection: informational_content
const informationalContentSample = {
  "about": {
    "id": "about",
    "title": "About Dozlo",
    "version": "1.0.0",
    "appIcon": "moon-outline",
    "sections": [
      {
        "id": "about-dozlo",
        "title": "About Dozlo",
        "content": "Dozlo is your personal sleep companion, designed to help you relax, unwind, and achieve better sleep through carefully curated sleep stories, meditation content, and ambient sounds.",
        "additionalContent": "Our mission is to provide a peaceful and calming experience that helps you transition from the busyness of daily life into a restful night's sleep."
      },
      {
        "id": "key-features",
        "title": "Key Features",
        "type": "features",
        "features": [
          {
            "icon": "book-outline",
            "title": "Sleep Stories",
            "description": "Narrated stories designed to help you drift into sleep"
          },
          {
            "icon": "leaf-outline",
            "title": "Meditation",
            "description": "Guided meditation sessions for relaxation"
          },
          {
            "icon": "musical-notes-outline",
            "title": "Ambient Sounds",
            "description": "Soothing nature sounds and white noise"
          },
          {
            "icon": "heart-outline",
            "title": "Personal Library",
            "description": "Save and organize your favorite content"
          }
        ]
      },
      {
        "id": "contact-us",
        "title": "Contact Us",
        "content": "We'd love to hear from you! Reach out to us for support, feedback, or just to say hello.",
        "contactInfo": [
          {
            "icon": "mail-outline",
            "label": "Email",
            "value": "support@dozlo.com"
          },
          {
            "icon": "globe-outline",
            "label": "Website",
            "value": "www.dozlo.com"
          }
        ]
      },
      {
        "id": "legal",
        "title": "Legal",
        "type": "links",
        "links": [
          {
            "icon": "shield-checkmark-outline",
            "text": "Privacy Policy",
            "route": "/privacy-policy"
          },
          {
            "icon": "document-text-outline",
            "text": "Terms of Use",
            "route": "/terms-of-use"
          }
        ]
      },
      {
        "id": "footer",
        "type": "footer",
        "content": "© 2024 Dozlo. All rights reserved."
      }
    ]
  },
  "help-support": {
    "id": "help-support",
    "title": "Help & Support",
    "icon": "help-circle-outline",
    "sections": [
      {
        "id": "header",
        "type": "header",
        "title": "How can we help?",
        "subtitle": "Find answers to common questions or get in touch with our support team"
      },
      {
        "id": "quick-actions",
        "title": "Quick Actions",
        "type": "actions",
        "actions": [
          {
            "icon": "mail-outline",
            "text": "Contact Support",
            "action": "sendFeedback"
          },
          {
            "icon": "bug-outline",
            "text": "Report an Issue",
            "action": "reportIssue"
          }
        ]
      },
      {
        "id": "faq",
        "title": "Frequently Asked Questions",
        "type": "faq",
        "faqs": [
          {
            "question": "How do I create an account?",
            "answer": "You can create an account by tapping the 'Continue with Google' button on the sign-in page. This will securely authenticate you using your Google account."
          },
          {
            "question": "How do I save my favorite stories?",
            "answer": "While listening to a story, tap the bookmark icon to save it to your favorites. You can access all your saved stories in the Library section."
          },
          {
            "question": "Can I use the app offline?",
            "answer": "Currently, the app requires an internet connection to stream audio content. We're working on offline functionality for future updates."
          },
          {
            "question": "How do I contact support?",
            "answer": "You can contact our support team by emailing support@dozlo.com or using the 'Contact Support' option in the Help & Support section."
          },
          {
            "question": "Is my data secure?",
            "answer": "Yes, we take your privacy seriously. We use industry-standard security measures to protect your personal information. Please review our Privacy Policy for detailed information."
          }
        ]
      },
      {
        "id": "contact",
        "title": "Get in Touch",
        "type": "contact",
        "contactInfo": [
          {
            "icon": "mail-outline",
            "title": "Email Support",
            "value": "support@dozlo.com",
            "description": "We typically respond within 24 hours"
          },
          {
            "icon": "globe-outline",
            "title": "Website",
            "value": "www.dozlo.com",
            "description": "Visit our website for more information"
          }
        ]
      },
      {
        "id": "legal",
        "title": "Legal Information",
        "type": "links",
        "links": [
          {
            "icon": "shield-checkmark-outline",
            "text": "Privacy Policy",
            "route": "/privacy-policy"
          },
          {
            "icon": "document-text-outline",
            "text": "Terms of Use",
            "route": "/terms-of-use"
          }
        ]
      }
    ]
  },
  "data-usage": {
    "id": "data-usage",
    "title": "Data Usage",
    "icon": "cellular-outline",
    "sections": [
      {
        "id": "header",
        "type": "header",
        "title": "Data Usage Information",
        "subtitle": "Learn how Dozlo uses your mobile data and how to manage it"
      },
      {
        "id": "usage-overview",
        "title": "How Dozlo Uses Data",
        "type": "usage-items",
        "items": [
          {
            "icon": "musical-notes-outline",
            "category": "Audio Streaming",
            "description": "Streaming sleep stories and meditation content",
            "dataUsage": "~50MB per hour"
          },
          {
            "icon": "cloud-download-outline",
            "category": "App Updates",
            "description": "Downloading app updates and new content",
            "dataUsage": "Varies by update size"
          },
          {
            "icon": "person-outline",
            "category": "User Data",
            "description": "Syncing preferences and usage data",
            "dataUsage": "~5MB per month"
          }
        ]
      },
      {
        "id": "data-saving",
        "title": "Data Saving Tips",
        "type": "tips",
        "tips": [
          {
            "icon": "wifi-outline",
            "tip": "Use Wi-Fi When Possible",
            "description": "Connect to Wi-Fi to avoid using mobile data for large downloads"
          },
          {
            "icon": "settings-outline",
            "tip": "Adjust Audio Quality",
            "description": "Lower audio quality uses less data"
          },
          {
            "icon": "analytics-outline",
            "tip": "Monitor Your Usage",
            "description": "Check your device settings to track data consumption"
          }
        ]
      },
      {
        "id": "privacy-note",
        "title": "Privacy & Data",
        "content": "We respect your privacy and only collect data necessary to provide our services. For detailed information about how we handle your data, please review our Privacy Policy.",
        "action": {
          "icon": "shield-checkmark-outline",
          "text": "View Privacy Policy",
          "route": "/privacy-policy"
        }
      },
      {
        "id": "contact-info",
        "title": "Questions?",
        "content": "If you have questions about data usage or privacy, contact us at privacy@dozlo.com"
      }
    ]
  }
};

// Export the sample data
module.exports = {
  sampleData,
  legalContentSample,
  informationalContentSample
}; 