package io.ionic.starter;

import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;

import com.getcapacitor.Plugin;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * AppKillMediaCleanup
 *
 * Minimal native helper to clear any lingering media notifications when the app/activity is destroyed.
 * This helps avoid the hanging media notification when the WebView process is gone.
 */
@CapacitorPlugin(name = "AppKillMediaCleanup")
public class AppKillMediaCleanup extends Plugin {

    @Override
    protected void handleOnDestroy() {
        super.handleOnDestroy();
        stopMediaSessionServiceAndClearNotifications();
    }

    @Override
    protected void handleOnStop() {
        super.handleOnStop();
        // As an extra guard, also clear when the activity stops and is finishing
        if (getActivity() != null && getActivity().isFinishing()) {
            stopMediaSessionServiceAndClearNotifications();
        }
    }

    private void stopMediaSessionServiceAndClearNotifications() {
        try {
            Context context = getContext();
            if (context == null) return;

            // Best-effort: stop the @jofr/capacitor-media-session service if running
            try {
                Intent stopServiceIntent = new Intent(context, io.github.jofr.capacitor.mediasessionplugin.MediaSessionService.class);
                context.stopService(stopServiceIntent);
            } catch (Throwable ignored) {
                // Ignore if class is not present or service not running
            }

            NotificationManager notificationManager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (notificationManager != null) {
                // Cancel the known media session notification ID
                try { notificationManager.cancel(1); } catch (Throwable ignored) {}
                notificationManager.cancelAll();
            }
        } catch (Throwable ignored) {
            // Best-effort cleanup; ignore any exceptions
        }
    }
}


