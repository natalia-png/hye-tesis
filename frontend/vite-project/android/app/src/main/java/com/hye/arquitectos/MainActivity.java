package com.hye.app;

import android.os.Bundle;
import androidx.core.view.WindowCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Dibuja detrás de la barra de navegación y status bar (edge-to-edge)
        // Hace que env(safe-area-inset-bottom) funcione correctamente
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
    }
}
