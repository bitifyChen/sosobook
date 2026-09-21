<script setup>
import { ArrowLeft, Check, X } from 'lucide-vue-next';

const store = useAppStore();
const accountLabel = computed(() => store.state.user?.email || '尚未取得 Google 帳號');
const isMockAccount = computed(() => store.state.mode === 'mock');
</script>

<template>
  <section class="settings-page">
    <div class="settings-page-inner">
      <header class="settings-page-header">
        <RouterLink class="settings-close" to="/setting" aria-label="返回設定">
          <X :size="22" />
        </RouterLink>
        <p class="eyebrow">ACCOUNT</p>
        <h1>帳號綁定</h1>
      </header>

      <section class="settings-block" aria-labelledby="settings-account-title">
        <div class="settings-block-heading">
          <span class="google-mark">G</span>
          <div>
            <p class="eyebrow">GOOGLE ACCOUNT</p>
            <h2 id="settings-account-title">Google 綁定</h2>
          </div>
          <span class="settings-status"
            ><Check :size="15" />{{ isMockAccount ? '測試帳號' : '已綁定' }}</span
          >
        </div>
        <p class="settings-account-email">{{ accountLabel }}</p>
        <small v-if="isMockAccount" class="settings-hint"
          >目前使用本機測試模式，資料只會保存在這個瀏覽器。</small
        >
        <p class="settings-account-note">
          登入後，你的會員卡、體重紀錄與競賽資料會跟著這個帳號保存。
        </p>
      </section>

      <RouterLink class="settings-back-link" to="/setting"
        ><ArrowLeft :size="17" />回到設定</RouterLink
      >
    </div>
  </section>
</template>

<route lang="json">
{
  "name": "setting-account",
  "path": "/setting/account"
}
</route>
