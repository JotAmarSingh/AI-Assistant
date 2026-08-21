package com.amarsingh.daytrace;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(DayTraceNativePlugin.class);
        super.onCreate(savedInstanceState);
    }
}

