package com.dozlo.app;

import android.graphics.Color;
import android.os.Bundle;

import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final String APP_DARK_COLOR = "#120f29";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Keep system bars and initial WebView frame aligned with app dark theme to avoid
        // white flashes and low-contrast status bar icons on some OEM Android skins.
        getWindow().setStatusBarColor(Color.parseColor(APP_DARK_COLOR));
        getWindow().setNavigationBarColor(Color.parseColor(APP_DARK_COLOR));

        WindowInsetsControllerCompat controller =
                WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        if (controller != null) {
            controller.setAppearanceLightStatusBars(false);
            controller.setAppearanceLightNavigationBars(false);
        }

        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().setBackgroundColor(Color.parseColor(APP_DARK_COLOR));
        }
    }
}
