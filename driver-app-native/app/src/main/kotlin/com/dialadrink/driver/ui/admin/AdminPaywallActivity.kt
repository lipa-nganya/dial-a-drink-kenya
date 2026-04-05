package com.dialadrink.driver.ui.admin

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.os.CountDownTimer
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import com.dialadrink.driver.R
import com.dialadrink.driver.databinding.ActivityAdminPaywallBinding
import com.dialadrink.driver.ui.auth.UserTypeSelectionActivity
import com.dialadrink.driver.utils.SharedPrefs

/**
 * Full-screen lock when admin access is restricted by server (ADMIN_PAYWALL).
 * Back is disabled; user must leave the app or reinstall after access is restored.
 */
class AdminPaywallActivity : AppCompatActivity() {
    private lateinit var binding: ActivityAdminPaywallBinding
    private var unlockAtMillis: Long = 0L
    private var countDownTimer: CountDownTimer? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityAdminPaywallBinding.inflate(layoutInflater)
        setContentView(binding.root)

        unlockAtMillis = savedInstanceState?.getLong(STATE_UNLOCK_AT)
            ?: (System.currentTimeMillis() + COOLDOWN_MS)

        val tel = getString(R.string.admin_paywall_contact_tel)
        binding.buttonContactAdmin.setOnClickListener {
            startActivity(Intent(Intent.ACTION_DIAL, Uri.parse(tel)))
        }

        binding.buttonRetryLogin.setOnClickListener {
            navigateToRetryLogin()
            finish()
        }

        onBackPressedDispatcher.addCallback(
            this,
            object : OnBackPressedCallback(true) {
                override fun handleOnBackPressed() {
                    // Intentionally no-op — cannot dismiss
                }
            }
        )

        startOrRefreshCountdown()
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        outState.putLong(STATE_UNLOCK_AT, unlockAtMillis)
    }

    override fun onDestroy() {
        countDownTimer?.cancel()
        super.onDestroy()
    }

    private fun startOrRefreshCountdown() {
        countDownTimer?.cancel()
        val remaining = unlockAtMillis - System.currentTimeMillis()
        if (remaining <= 0) {
            binding.buttonRetryLogin.isEnabled = true
            binding.buttonRetryLogin.text = getString(R.string.admin_paywall_retry_login)
            return
        }
        binding.buttonRetryLogin.isEnabled = false
        updateRetryButtonText(remaining)

        countDownTimer = object : CountDownTimer(remaining, 1000L) {
            override fun onTick(millisUntilFinished: Long) {
                val left = unlockAtMillis - System.currentTimeMillis()
                if (left <= 0) {
                    cancel()
                    binding.buttonRetryLogin.isEnabled = true
                    binding.buttonRetryLogin.text = getString(R.string.admin_paywall_retry_login)
                } else {
                    updateRetryButtonText(left)
                }
            }

            override fun onFinish() {
                binding.buttonRetryLogin.isEnabled = true
                binding.buttonRetryLogin.text = getString(R.string.admin_paywall_retry_login)
            }
        }.start()
    }

    private fun updateRetryButtonText(millisRemaining: Long) {
        val totalSec = ((millisRemaining + 999) / 1000).toInt().coerceAtLeast(0)
        val m = totalSec / 60
        val s = totalSec % 60
        binding.buttonRetryLogin.text = getString(R.string.admin_paywall_retry_login_timer, m, s)
    }

    private fun navigateToRetryLogin() {
        val phone = SharedPrefs.getAdminPhone(this)
        if (!phone.isNullOrBlank()) {
            startActivity(
                Intent(this, AdminLoginActivity::class.java).apply {
                    putExtra("phone", phone)
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
                }
            )
        } else {
            startActivity(
                Intent(this, UserTypeSelectionActivity::class.java).apply {
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
                }
            )
        }
    }

    companion object {
        private const val STATE_UNLOCK_AT = "admin_paywall_unlock_at"
        private const val COOLDOWN_MS = 5 * 60 * 1000L
    }
}
