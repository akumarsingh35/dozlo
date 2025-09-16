// This file can be replaced during build by using the `fileReplacements` array.
// `ng build` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

export const environment = {
  production: false,
  r2WorkerUrl: 'https://dozlo-audio-signed-urls.akumarsingh35.workers.dev', // Audio worker URL
  r2ImageWorkerUrl: 'https://dozlo-image-worker.akumarsingh35.workers.dev', // Image worker URL
  r2AppSecret: 'dozlo-r2-secret-2024-xyz789-abc123-def456-ghi789' // Replace with your actual secret key
};

/*
 * For easier debugging in development mode, you can import the following file
 * to ignore zone related error stack frames such as `zone.run`, `zoneDelegate.invokeTask`.
 *
 * This import should be commented out in production mode because it will have a negative impact
 * on performance if an error is thrown.
 */
// import 'zone.js/plugins/zone-error';  // Included with Angular CLI.
