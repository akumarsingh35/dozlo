import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'see-all',
    loadComponent: () => import('./see-all/see-all.page').then(m => m.SeeAllPage)
  },
  {
    path: 'explore-category',
    loadComponent: () => import('./explore-category/explore-category.page').then(m => m.ExploreCategoryPage)
  },
  {
    path: 'sign-in',
    loadComponent: () => import('./sign-in/sign-in.page').then(m => m.SignInPage)
  },
  {
    path: 'home',
    loadComponent: () => import('./home/home.page').then( m => m.HomePage)
  },
  {
    path: 'explore',
    loadComponent: () => import('./explore/explore.page').then( m => m.ExplorePage)
  },
  {
    path: 'library',
    loadComponent: () => import('./library/library.page').then( m => m.LibraryPage)
  },
  {
    path: 'profile',
    loadComponent: () => import('./profile/profile.page').then( m => m.ProfilePage)
  },
  {
    path: 'privacy-policy',
    loadComponent: () => import('./privacy-policy/privacy-policy.page').then(m => m.PrivacyPolicyPage)
  },
  {
    path: 'terms-of-use',
    loadComponent: () => import('./terms-of-use/terms-of-use.page').then(m => m.TermsOfUsePage)
  },
  {
    path: 'about',
    loadComponent: () => import('./about/about.page').then(m => m.AboutPage)
  },
  {
    path: 'help-support',
    loadComponent: () => import('./help-support/help-support.page').then(m => m.HelpSupportPage)
  },
  {
    path: 'data-usage',
    loadComponent: () => import('./data-usage/data-usage.page').then(m => m.DataUsagePage)
  },
  {
    path: 'back-button-test',
    loadComponent: () => import('./pages/back-button-test/back-button-test.page').then(m => m.BackButtonTestPage)
  },
  {
    path: '',
    redirectTo: 'home',
    pathMatch: 'full'
  },
];

