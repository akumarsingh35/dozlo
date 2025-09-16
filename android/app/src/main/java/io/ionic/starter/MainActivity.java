package io.ionic.starter;

import android.os.Bundle;
import android.view.KeyEvent;
import android.webkit.WebView;
import android.webkit.WebSettings;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;
import com.getcapacitor.Plugin;
import com.google.firebase.FirebaseApp;
import com.google.firebase.auth.FirebaseAuth;
import java.util.ArrayList;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        registerPlugin(AppKillMediaCleanup.class);
        // Initialize Firebase
        FirebaseApp.initializeApp(this);
        
        // Ensure Firebase Auth is initialized
        FirebaseAuth.getInstance();
        
        // Configure WebView to prevent scrollbar issues
        WebView webView = bridge.getWebView();
        WebSettings webSettings = webView.getSettings();
        
        // Prevent overscroll bounce and scrollbar issues
        webView.setOverScrollMode(WebView.OVER_SCROLL_NEVER);
        webView.setVerticalScrollBarEnabled(false);
        webView.setHorizontalScrollBarEnabled(false);
        
        // Optimize WebView settings for better performance
        webSettings.setDomStorageEnabled(true);
        webSettings.setJavaScriptEnabled(true);
        webSettings.setAllowFileAccess(true);
        webSettings.setAllowContentAccess(true);
        webSettings.setLoadsImagesAutomatically(true);
        webSettings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        
        // Set up custom WebViewClient to handle back button
        webView.setWebViewClient(new BridgeWebViewClient(bridge) {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return super.shouldOverrideUrlLoading(view, url);
            }
        });
    }
    
    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        // Let Capacitor handle the back button natively
        // This will trigger the App.addListener('backButton') in JavaScript
        if (keyCode == KeyEvent.KEYCODE_BACK) {
            return false; // Let the default behavior handle it
        }
        return super.onKeyDown(keyCode, event);
    }
    
    @Override
    public boolean onKeyUp(int keyCode, KeyEvent event) {
        // Let Capacitor handle the back button natively
        if (keyCode == KeyEvent.KEYCODE_BACK) {
            return false; // Let the default behavior handle it
        }
        return super.onKeyUp(keyCode, event);
    }
}
