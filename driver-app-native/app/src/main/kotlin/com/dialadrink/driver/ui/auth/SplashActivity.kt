package com.dialadrink.driver.ui.auth

import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import androidx.appcompat.app.AppCompatActivity
import com.dialadrink.driver.R

class SplashActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_splash)

        // Give the user enough time to actually see the splash artwork.
        // (Forwarding too fast can make the system icon/splash remain visible.)
        val splashDelayMs = 900L
        Handler(Looper.getMainLooper()).postDelayed({
            startActivity(Intent(this, PhoneNumberActivity::class.java))
            finish()
            // Let the default activity transition play.
            // overridePendingTransition(0, 0) makes the splash effectively too fast.
        }, splashDelayMs)
    }
}
