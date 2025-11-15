import { Injectable } from '@angular/core';
import { Firestore, collection, getDocs, doc, getDoc, query, orderBy, limit, where } from '@angular/fire/firestore';
import { Observable, from, map, catchError, of, BehaviorSubject } from 'rxjs';

export interface FirebaseCategory {
  id: string;
  name: string;
  sections: FirebaseSection[];
}

export interface FirebaseSection {
  id: string;
  title: string;
  sectionName: string;
  sectionType: 'sliderCards' | 'cards' | 'stacks';
  stories: FirebaseStory[];
}

export interface FirebaseStory {
  id: string;
  title: string;
  subTitle?: string;
  description?: string;
  imageUrl?: string;
  imagePath?: string;
  audioUrl?: string;
  audioPath?: string;
  r2Path?: string;
  duration?: number;
  narratorName?: string;
  category?: string;
  createdAt?: any;
  updatedAt?: any;
  isLoading?: boolean;
  imageLoaded?: boolean;
  isPreloaded?: boolean;
}

export interface ExploreCategory {
  id: string;
  name: string;
  imagePath: string;
  imageUrl?: string;
  description: string;
  color: string;
  categoryType?: 'same' | 'mixed';
}

export interface PrivacyPolicy {
  id: string;
  title: string;
  content: string; // Contains <br> tags for line breaks
  lastUpdated: string;
  version: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TermsOfUse {
  id: string;
  title: string;
  content: string; // Contains <br> tags for line breaks
  lastUpdated: string;
  version: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LegalDocument {
  id: string;
  type: 'privacy_policy' | 'terms_of_use';
  title: string;
  content: string; // Contains <br> tags for line breaks
  lastUpdated: string;
  version: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// New interface for dozlo_abouts collection
export interface AppContent {
  id: string;
  lastUpdated: string;
  version: string;
  contactInfo: {
    support: {
      email: string;
      responseTime: string;
    };
    feedback: {
      email: string;
      subject: string;
    };
    issues: {
      email: string;
      subject: string;
    };
    privacy: {
      email: string;
    };
    terms: {
      email: string;
    };
    general: {
      email: string;
    };
    website: string;
    playStoreUrl: string;
  };
  privacyPolicy: {
    title: string;
    lastUpdated: string;
    content: string;
  };
  termsOfUse: {
    title: string;
    lastUpdated: string;
    content: string;
  };
  about: {
    title: string;
    appName: string;
    version: string;
    description: string;
    mission: string;
    features: Array<{
      icon: string;
      title: string;
      description: string;
    }>;
    copyright: string;
  };
  helpSupport: {
    title: string;
    header: {
      title: string;
      subtitle: string;
    };
    quickActions: Array<{
      icon: string;
      title: string;
      action: string;
      email: string;
      subject: string;
    }>;
    faq: Array<{
      question: string;
      answer: string;
    }>;
    contactInfo: {
      email: {
        title: string;
        address: string;
        responseTime: string;
      };
      website: {
        title: string;
        url: string;
        description: string;
      };
    };
  };
  dataUsage: {
    title: string;
    header: {
      title: string;
      subtitle: string;
    };
    usageOverview: {
      title: string;
      items: Array<{
        icon: string;
        category: string;
        description: string;
        dataUsage: string;
      }>;
    };
    dataSavingTips: {
      title: string;
      tips: Array<{
        tip: string;
        description: string;
      }>;
    };
    privacyNote: {
      title: string;
      content: string;
      privacyPolicyButton: string;
    };
    contactInfo: {
      title: string;
      content: string;
      email: string;
    };
  };
  profile: {
    feedbackSupportItems: Array<{
      icon: string;
      text: string;
      action: string;
      email?: string;
      subject?: string;
      url?: string;
    }>;
    settingsItems: Array<{
      icon: string;
      text: string;
      action: string;
    }>;
    legalItems: Array<{
      icon: string;
      text: string;
      action: string;
    }>;
  };
  emailTemplates: {
    feedback: {
      subject: string;
      bodyTemplate: string;
    };
    support: {
      subject: string;
      bodyTemplate: string;
    };
    issueReport: {
      subject: string;
      bodyTemplate: string;
    };
  };
}

export interface HomepageData {
  categories: FirebaseCategory[];
  stories: FirebaseStory[];
}

@Injectable({
  providedIn: 'root'
})
export class FirebaseDataService {
  // Global data cache
  private globalDataCache: HomepageData | null = null;
  private dataLoadedSubject = new BehaviorSubject<boolean>(false);
  private categoriesSubject = new BehaviorSubject<FirebaseCategory[]>([]);
  private storiesSubject = new BehaviorSubject<FirebaseStory[]>([]);

  // Public observables
  public dataLoaded$ = this.dataLoadedSubject.asObservable();
  public categories$ = this.categoriesSubject.asObservable();
  public stories$ = this.storiesSubject.asObservable();

  constructor(private firestore: Firestore) {
    // Defer initialization to avoid Firebase warning
    setTimeout(() => {
      this.loadGlobalData();
    }, 0);
  }

  /**
   * Load global data once for the entire app
   */
  private async loadGlobalData(): Promise<void> {
    try {
      console.log('🌍 Loading global Firebase data...');
      
      if (this.globalDataCache) {
        console.log('🌍 Using cached data');
        this.updateSubjects();
        return;
      }

      const data = await this.fetchHomepageData();
      this.globalDataCache = data;
      this.updateSubjects();
      this.dataLoadedSubject.next(true);
      
      console.log('🌍 Global data loaded successfully');
    } catch (error) {
      console.error('🌍 Error loading global data:', error);
      this.dataLoadedSubject.next(false);
    }
  }

  /**
   * Update all subjects with cached data
   */
  private updateSubjects(): void {
    if (this.globalDataCache) {
      this.categoriesSubject.next(this.globalDataCache.categories);
      this.storiesSubject.next(this.globalDataCache.stories);
    }
  }

  /**
   * Get categories (from cache)
   */
  getCategories(): Observable<FirebaseCategory[]> {
    return this.categories$;
  }

  /**
   * Get all stories (from cache)
   */
  getAllStories(): Observable<FirebaseStory[]> {
    return this.stories$;
  }

  /**
   * Get sections for a specific category
   */
  getSectionsForCategory(categoryName: string): Observable<FirebaseSection[]> {
    return this.categories$.pipe(
      map(categories => {
        const category = categories.find(cat => cat.name === categoryName);
        return category ? category.sections : [];
      })
    );
  }

  /**
   * Get the first category (Latest) for default display
   */
  getDefaultCategory(): Observable<FirebaseCategory | null> {
    return this.categories$.pipe(
      map(categories => categories.length > 0 ? categories[0] : null)
    );
  }

  /**
   * Force refresh global data (if needed)
   */
  refreshGlobalData(): Observable<boolean> {
    this.globalDataCache = null;
    this.dataLoadedSubject.next(false);
    this.categoriesSubject.next([]);
    this.storiesSubject.next([]);
    return from(this.fetchHomepageData()).pipe(
      map((data) => {
        this.globalDataCache = data;
        this.updateSubjects();
        this.dataLoadedSubject.next(true);
        return true;
      }),
      catchError((err) => {
        console.error('🌍 refreshGlobalData failed:', err);
        this.dataLoadedSubject.next(false);
        return of(false);
      })
    );
  }

  /**
   * Get homepage data including categories and stories
   */
  getHomepageData(): Observable<HomepageData> {
    return from(this.fetchHomepageData());
  }

  /**
   * Fetch categories with their sections and stories
   */
  private async fetchHomepageData(): Promise<HomepageData> {
    try {
      console.log('🔄 Starting to fetch homepage data...');
      
      const categories: FirebaseCategory[] = [];
      const allStories: FirebaseStory[] = [];

      // Fetch categories first
      const categoriesRef = collection(this.firestore, 'dozlo_categories');
      console.log('📚 Fetching categories from dozlo_categories collection...');
      const categoriesSnapshot = await getDocs(categoriesRef);
      console.log('📚 Categories snapshot size:', categoriesSnapshot.size);
      
      // Fetch all stories first
      const storiesRef = collection(this.firestore, 'dozlo_stories');
      console.log('📚 Fetching all stories from dozlo_stories...');
      const storiesSnapshot = await getDocs(storiesRef);
      console.log('📚 Stories snapshot size:', storiesSnapshot.size);
      
      // Create a map of story IDs to story objects for quick lookup
      const storyMap = new Map<string, FirebaseStory>();
      
      for (const storyDoc of storiesSnapshot.docs) {
        const storyData = storyDoc.data() as any;
        
        if (storyData.stories && Array.isArray(storyData.stories)) {
          for (const storyItem of storyData.stories) {
            const story: FirebaseStory = {
              id: storyItem.id || 'unknown',
              title: storyItem.title || 'Untitled Story',
              subTitle: storyItem.subTitle || '',
              description: storyItem.description || '',
              imagePath: storyItem.imagePath || '',
              audioPath: storyItem.audioPath || '',
              duration: storyItem.duration || 0,
              narratorName: storyItem.narratorName || 'Unknown Narrator',
              category: storyItem.category || 'unknown',
              createdAt: storyItem.createdAt || new Date(),
              updatedAt: storyItem.updatedAt || new Date(),
              isLoading: false
            };
            
            storyMap.set(story.id, story);
            allStories.push(story);
          }
        }
      }

      console.log('📚 Total stories loaded:', allStories.length);
      console.log('📚 Story IDs available:', Array.from(storyMap.keys()));

      // Now process categories and populate sections
      for (const categoryDoc of categoriesSnapshot.docs) {
        const categoryData = categoryDoc.data() as any;
        
        if (categoryData.categories && Array.isArray(categoryData.categories)) {
          for (const categoryItem of categoryData.categories) {
            console.log('📚 Processing category:', categoryItem.name);
            
            const category: FirebaseCategory = {
              id: categoryItem.id || 'unknown',
              name: categoryItem.name || 'Unnamed Category',
              sections: []
            };

            if (categoryItem.sections && Array.isArray(categoryItem.sections)) {
              for (const sectionItem of categoryItem.sections) {
                console.log(`📚 Processing section: ${sectionItem.sectionName}`);
                
                const section: FirebaseSection = {
                  id: sectionItem.sectionName || 'unknown',
                  title: sectionItem.sectionName || 'Untitled Section',
                  sectionName: sectionItem.sectionName || 'Untitled Section',
                  sectionType: sectionItem.sectionType || 'cards',
                  stories: []
                };

                // Populate stories for this section using storyIds
                if (sectionItem.storyIds && Array.isArray(sectionItem.storyIds)) {
                  console.log(`📚 Section ${section.sectionName} has ${sectionItem.storyIds.length} story IDs:`, sectionItem.storyIds);
                  
                  section.stories = sectionItem.storyIds
                    .map((storyId: string) => storyMap.get(storyId))
                    .filter((story: FirebaseStory | undefined) => story !== undefined);
                  
                  console.log(`📚 Section ${section.sectionName} populated with ${section.stories.length} stories`);
                } else {
                  console.log(`📚 Section ${section.sectionName} has no storyIds`);
                }

                category.sections.push(section);
              }
            }
            
            categories.push(category);
            console.log(`📚 Category ${category.name} has ${category.sections.length} sections with ${category.sections.reduce((total, sec) => total + sec.stories.length, 0)} total stories`);
          }
        }
      }

      const result: HomepageData = {
        categories,
        stories: allStories
      };

      console.log('✅ Homepage data fetched successfully:', {
        categoriesCount: categories.length,
        storiesCount: allStories.length,
        categories: categories.map(c => ({ 
          id: c.id, 
          name: c.name, 
          sectionsCount: c.sections?.length || 0,
          totalStoriesInCategory: c.sections?.reduce((total, section) => total + (section.stories?.length || 0), 0) || 0
        }))
      });

      return result;
    } catch (error) {
      console.error('❌ Error fetching homepage data:', error);
      throw error;
    }
  }

  /**
   * Get a single story by ID
   */
  getStoryById(storyId: string): Observable<FirebaseStory | null> {
    return from(this.fetchStoryById(storyId));
  }

  private async fetchStoryById(storyId: string): Promise<FirebaseStory | null> {
    try {
      const storiesRef = collection(this.firestore, 'dozlo_stories');
      const storiesSnapshot = await getDocs(storiesRef);
      
      for (const storyDoc of storiesSnapshot.docs) {
        const storyData = storyDoc.data() as any;
        
        if (storyData.stories && Array.isArray(storyData.stories)) {
          const foundStory = storyData.stories.find((story: any) => story.id === storyId);
          if (foundStory) {
            return {
              id: foundStory.id,
              title: foundStory.title || 'Untitled Story',
              subTitle: foundStory.subTitle || foundStory.description || '',
              description: foundStory.description || '',
              imagePath: foundStory.imagePath || '',
              audioPath: foundStory.audioPath || '',
              duration: foundStory.duration || 0,
              narratorName: foundStory.narratorName || 'Unknown Narrator',
              category: foundStory.category || 'unknown',
              createdAt: foundStory.createdAt,
              updatedAt: foundStory.updatedAt,
              isLoading: false
            };
          }
        }
      }
      return null;
    } catch (error) {
      console.error('❌ Error fetching story:', error);
      return null;
    }
  }

  /**
   * Get stories by category
   */
  getStoriesByCategory(categoryId: string): Observable<FirebaseStory[]> {
    return from(this.fetchStoriesByCategory(categoryId));
  }

  private async fetchStoriesByCategory(categoryId: string): Promise<FirebaseStory[]> {
    try {
      const storiesRef = collection(this.firestore, 'dozlo_stories');
      const storiesSnapshot = await getDocs(storiesRef);
      const stories: FirebaseStory[] = [];

      for (const storyDoc of storiesSnapshot.docs) {
        const storyData = storyDoc.data() as any;
        
        if (storyData.stories && Array.isArray(storyData.stories)) {
          for (const storyItem of storyData.stories) {
            if (storyItem.category && storyItem.category.toLowerCase() === categoryId.toLowerCase()) {
              const story: FirebaseStory = {
                id: storyItem.id,
                title: storyItem.title || 'Untitled Story',
                subTitle: storyItem.subTitle || storyItem.description || '',
                description: storyItem.description || '',
                imagePath: storyItem.imagePath || '',
                audioPath: storyItem.audioPath || '',
                duration: storyItem.duration || 0,
                narratorName: storyItem.narratorName || 'Unknown Narrator',
                category: storyItem.category,
                createdAt: storyItem.createdAt,
                updatedAt: storyItem.updatedAt,
                isLoading: false
              };
              stories.push(story);
            }
          }
        }
      }

      return stories;
    } catch (error) {
      console.error('❌ Error fetching stories by category:', error);
      return [];
    }
  }

  /**
   * Temporary debug method to log full story data
   */
  async debugStoryData(): Promise<void> {
    try {
      console.log('🔍 DEBUG: Starting story data analysis...');
      const storiesRef = collection(this.firestore, 'dozlo_stories');
      const storiesSnapshot = await getDocs(storiesRef);
      
      console.log('🔍 DEBUG: Total story documents found:', storiesSnapshot.size);
      
      for (const storyDoc of storiesSnapshot.docs) {
        const storyData = storyDoc.data();
        console.log('🔍 DEBUG: Story document:', {
          id: storyDoc.id,
          hasStoriesArray: !!storyData['stories'],
          storiesCount: storyData['stories']?.length || 0,
          fullData: storyData
        });
        
        if (storyData['stories'] && Array.isArray(storyData['stories'])) {
          storyData['stories'].forEach((story: any, index: number) => {
            console.log(`🔍 DEBUG: Story ${index}:`, {
              id: story['id'],
              title: story['title'],
              category: story['category'],
              imagePath: story['imagePath'],
              audioPath: story['audioPath'],
              duration: story['duration'],
              narratorName: story['narratorName']
            });
          });
        }
      }
    } catch (error) {
      console.error('🔍 DEBUG: Error analyzing story data:', error);
    }
  }

  /**
   * Get explore categories from Firebase
   */
  getExploreCategories(): Observable<ExploreCategory[]> {
    return from(this.fetchExploreCategories());
  }

  /**
   * Get privacy policy from Firebase
   */
  getPrivacyPolicy(): Observable<PrivacyPolicy | null> {
    return from(this.fetchPrivacyPolicy());
  }

  /**
   * Get terms of use from Firebase
   */
  getTermsOfUse(): Observable<TermsOfUse | null> {
    return from(this.fetchTermsOfUse());
  }

  /**
   * Get legal document by type from Firebase (combined collection)
   */
  getLegalDocument(type: 'privacy_policy' | 'terms_of_use'): Observable<LegalDocument | null> {
    return from(this.fetchLegalDocument(type));
  }

  private async fetchPrivacyPolicy(): Promise<PrivacyPolicy | null> {
    try {
      console.log('🔒 Fetching privacy policy...');
      const privacyRef = collection(this.firestore, 'dozlo_privacy_policies');
      
      // Query for active privacy policy, ordered by last updated
      const privacyQuery = query(
        privacyRef,
        where('isActive', '==', true),
        orderBy('lastUpdated', 'desc'),
        limit(1)
      );
      
      const privacySnapshot = await getDocs(privacyQuery);
      
      if (privacySnapshot.empty) {
        console.log('🔒 No active privacy policy found');
        return null;
      }
      
      const privacyDoc = privacySnapshot.docs[0];
      const privacyData = privacyDoc.data() as PrivacyPolicy;
      
      // Add the document ID to the data
      const privacyPolicy: PrivacyPolicy = {
        ...privacyData,
        id: privacyDoc.id
      };
      
      console.log('🔒 Privacy policy loaded:', privacyPolicy.title);
      return privacyPolicy;
    } catch (error) {
      console.error('❌ Error fetching privacy policy:', error);
      return null;
    }
  }

  private async fetchTermsOfUse(): Promise<TermsOfUse | null> {
    try {
      console.log('🔒 Fetching terms of use...');
      const termsRef = collection(this.firestore, 'dozlo_terms_of_use');
      
      // Query for active terms of use, ordered by last updated
      const termsQuery = query(
        termsRef,
        where('isActive', '==', true),
        orderBy('lastUpdated', 'desc'),
        limit(1)
      );
      
      const termsSnapshot = await getDocs(termsQuery);
      
      if (termsSnapshot.empty) {
        console.log('🔒 No active terms of use found');
        return null;
      }
      
      const termsDoc = termsSnapshot.docs[0];
      const termsData = termsDoc.data() as TermsOfUse;
      
      // Add the document ID to the data
      const termsOfUse: TermsOfUse = {
        ...termsData,
        id: termsDoc.id
      };
      
      console.log('🔒 Terms of use loaded:', termsOfUse.title);
      return termsOfUse;
    } catch (error) {
      console.error('❌ Error fetching terms of use:', error);
      return null;
    }
  }

  private async fetchLegalDocument(type: 'privacy_policy' | 'terms_of_use'): Promise<LegalDocument | null> {
    try {
      console.log(`🔒 Fetching ${type}...`);
      const legalRef = collection(this.firestore, 'dozlo_legal_documents');
      
      // Query for active legal document by type, ordered by last updated
      const legalQuery = query(
        legalRef,
        where('type', '==', type),
        where('isActive', '==', true),
        orderBy('lastUpdated', 'desc'),
        limit(1)
      );
      
      const legalSnapshot = await getDocs(legalQuery);
      
      if (legalSnapshot.empty) {
        console.log(`🔒 No active ${type} found`);
        return null;
      }
      
      const legalDoc = legalSnapshot.docs[0];
      const legalData = legalDoc.data() as LegalDocument;
      
      // Add the document ID to the data
      const legalDocument: LegalDocument = {
        ...legalData,
        id: legalDoc.id
      };
      
      console.log(`🔒 ${type} loaded:`, legalDocument.title);
      return legalDocument;
    } catch (error) {
      console.error(`❌ Error fetching ${type}:`, error);
      return null;
    }
  }

  // New methods for dozlo_abouts collection

  /**
   * Get all app content from dozlo_abouts collection
   */
  getAppContent(): Observable<AppContent | null> {
    return from(this.fetchAppContent());
  }

  /**
   * Get privacy policy from dozlo_abouts collection
   */
  getPrivacyPolicyFromAbout(): Observable<AppContent['privacyPolicy'] | null> {
    return this.getAppContent().pipe(
      map(content => content?.privacyPolicy || null)
    );
  }

  /**
   * Get terms of use from dozlo_abouts collection
   */
  getTermsOfUseFromAbout(): Observable<AppContent['termsOfUse'] | null> {
    return this.getAppContent().pipe(
      map(content => content?.termsOfUse || null)
    );
  }

  /**
   * Get about page content from dozlo_abouts collection
   */
  getAboutContent(): Observable<AppContent['about'] | null> {
    return this.getAppContent().pipe(
      map(content => content?.about || null)
    );
  }

  /**
   * Get help & support content from dozlo_abouts collection
   */
  getHelpSupportContent(): Observable<AppContent['helpSupport'] | null> {
    return this.getAppContent().pipe(
      map(content => content?.helpSupport || null)
    );
  }

  /**
   * Get data usage content from dozlo_abouts collection
   */
  getDataUsageContent(): Observable<AppContent['dataUsage'] | null> {
    return this.getAppContent().pipe(
      map(content => content?.dataUsage || null)
    );
  }

  /**
   * Get profile page content from dozlo_abouts collection
   */
  getProfileContent(): Observable<AppContent['profile'] | null> {
    return this.getAppContent().pipe(
      map(content => content?.profile || null)
    );
  }

  /**
   * Get contact information from dozlo_abouts collection
   */
  getContactInfo(): Observable<AppContent['contactInfo'] | null> {
    return this.getAppContent().pipe(
      map(content => content?.contactInfo || null)
    );
  }

  /**
   * Get email templates from dozlo_abouts collection
   */
  getEmailTemplates(): Observable<AppContent['emailTemplates'] | null> {
    return this.getAppContent().pipe(
      map(content => content?.emailTemplates || null)
    );
  }

  private async fetchAppContent(): Promise<AppContent | null> {
    try {
      console.log('📱 Fetching app content from dozlo_abouts...');
      const aboutsRef = collection(this.firestore, 'dozlo_abouts');
      
      // Get the main content document
      const aboutsSnapshot = await getDocs(aboutsRef);
      
      if (aboutsSnapshot.empty) {
        console.log('📱 No app content found in dozlo_abouts collection');
        return null;
      }
      
      // Get the first document (assuming there's only one main content document)
      const aboutsDoc = aboutsSnapshot.docs[0];
      const aboutsData = aboutsDoc.data();
      
      console.log('📱 Raw Firebase document data:', aboutsData);
      console.log('📱 Document ID:', aboutsDoc.id);
      
      // The data is nested under 'app_content' key
      const appContentData = aboutsData['app_content'] as AppContent;
      
      console.log('📱 Extracted app_content data:', appContentData);
      
      if (!appContentData) {
        console.log('📱 No app_content found in dozlo_abouts document');
        console.log('📱 Available keys in document:', Object.keys(aboutsData));
        return null;
      }
      
      // Add the document ID to the data
      const appContent: AppContent = {
        ...appContentData,
        id: aboutsDoc.id
      };
      
      // Log detailed structure for debugging
      console.log('📱 ===== COMPLETE FIREBASE DATA STRUCTURE =====');
      console.log('📱 App Content ID:', appContent.id);
      console.log('📱 Version:', appContent.version);
      console.log('📱 Last Updated:', appContent.lastUpdated);
      
      // Log contact info
      console.log('📱 Contact Info:', {
        support: appContent.contactInfo?.support,
        feedback: appContent.contactInfo?.feedback,
        issues: appContent.contactInfo?.issues,
        privacy: appContent.contactInfo?.privacy,
        terms: appContent.contactInfo?.terms,
        general: appContent.contactInfo?.general,
        website: appContent.contactInfo?.website,
        playStoreUrl: appContent.contactInfo?.playStoreUrl
      });
      
      // Log privacy policy
      console.log('📱 Privacy Policy:', {
        title: appContent.privacyPolicy?.title,
        lastUpdated: appContent.privacyPolicy?.lastUpdated,
        contentLength: appContent.privacyPolicy?.content?.length
      });
      
      // Log terms of use
      console.log('📱 Terms of Use:', {
        title: appContent.termsOfUse?.title,
        lastUpdated: appContent.termsOfUse?.lastUpdated,
        contentLength: appContent.termsOfUse?.content?.length
      });
      
      // Log about content
      console.log('📱 About Content:', {
        title: appContent.about?.title,
        appName: appContent.about?.appName,
        description: appContent.about?.description,
        featuresCount: appContent.about?.features?.length
      });
      
      // Log help support content
      console.log('📱 Help Support Content:', {
        title: appContent.helpSupport?.title,
        header: appContent.helpSupport?.header,
        quickActionsCount: appContent.helpSupport?.quickActions?.length,
        faqCount: appContent.helpSupport?.faq?.length
      });
      
      // Log data usage content
      console.log('📱 Data Usage Content:', {
        title: appContent.dataUsage?.title,
        header: appContent.dataUsage?.header,
        usageItemsCount: appContent.dataUsage?.usageOverview?.items?.length,
        tipsCount: appContent.dataUsage?.dataSavingTips?.tips?.length
      });
      
      // Log profile content
      console.log('📱 Profile Content:', {
        feedbackSupportItemsCount: appContent.profile?.feedbackSupportItems?.length,
        settingsItemsCount: appContent.profile?.settingsItems?.length,
        legalItemsCount: appContent.profile?.legalItems?.length
      });
      
      // Log email templates
      console.log('📱 Email Templates:', {
        feedback: appContent.emailTemplates?.feedback,
        support: appContent.emailTemplates?.support,
        issueReport: appContent.emailTemplates?.issueReport
      });
      
      console.log('📱 ===== END FIREBASE DATA STRUCTURE =====');
      console.log('📱 App content loaded successfully');
      return appContent;
    } catch (error) {
      console.error('❌ Error fetching app content:', error);
      return null;
    }
  }

  private async fetchExploreCategories(): Promise<ExploreCategory[]> {
    try {
      console.log('🔍 Fetching explore categories...');
      const categoriesRef = collection(this.firestore, 'explore_categories');
      const categoriesSnapshot = await getDocs(categoriesRef);
      const categories: ExploreCategory[] = [];

      console.log('🔍 Total documents found:', categoriesSnapshot.size);

      for (const categoryDoc of categoriesSnapshot.docs) {
        const categoryData = categoryDoc.data() as any;
        console.log('🔍 Document data:', categoryData);
        
        // Check if the document has a 'data' property with 'categories' array
        if (categoryData.data && categoryData.data.categories && Array.isArray(categoryData.data.categories)) {
          for (const categoryItem of categoryData.data.categories) {
            const category: ExploreCategory = {
              id: categoryItem.id || 'unknown',
              name: categoryItem.name || 'Unnamed Category',
              imagePath: categoryItem.imagePath || '',
              description: categoryItem.description || '',
              color: categoryItem.color || '#6e57ff',
              categoryType: (categoryItem.categoryType === 'mixed' ? 'mixed' : 'same')
            };
            categories.push(category);
          }
        }
        // Also check if the document directly has a 'categories' array
        else if (categoryData.categories && Array.isArray(categoryData.categories)) {
          for (const categoryItem of categoryData.categories) {
            const category: ExploreCategory = {
              id: categoryItem.id || 'unknown',
              name: categoryItem.name || 'Unnamed Category',
              imagePath: categoryItem.imagePath || '',
              description: categoryItem.description || '',
              color: categoryItem.color || '#6e57ff',
              categoryType: (categoryItem.categoryType === 'mixed' ? 'mixed' : 'same')
            };
            categories.push(category);
          }
        }
      }

      console.log('🔍 Explore categories loaded:', categories.length);
      return categories;
    } catch (error) {
      console.error('❌ Error fetching explore categories:', error);
      return [];
    }
  }
} 