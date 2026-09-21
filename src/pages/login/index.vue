<script setup>
import { getRandomLoginBackground } from '@/data/assets';
const store = useAppStore();
const backgroundImage = getRandomLoginBackground();
const logoSrc = `${import.meta.env.BASE_URL}logo.webp`;
</script>

<template>
  <section class="login-page">
    <div class="login-art">
      <img :src="backgroundImage.src" :alt="backgroundImage.alt" />
    </div>
    <div class="login-sheet torn-card">
      <p class="eyebrow">一本屬於大家的健康手帳</p>
      <h1 class="login-brand">
        <img class="login-logo" :src="logoSrc" alt="SosoBook" />
      </h1>
      <p class="lead">每天貼一張心情貼紙，和朋友一起把小小的進步累積成冠軍紀錄。</p>
      <button
        class="primary-button google-button"
        :disabled="store.state.busy || store.state.mode === 'setup'"
        @click="store.login"
      >
        <span class="google-mark">G</span
        >{{ store.state.mode === 'setup' ? '等待資料庫設定' : '使用 Google 帳號繼續' }}
      </button>
      <p v-if="store.state.mode === 'setup'" class="setup-note">
        目前尚未連接 Firebase，完成資料庫設定後即可開始使用。
      </p>
      <p v-else-if="store.state.mode === 'mock'" class="setup-note">
        目前使用本機 Firebase 測試模式，資料只會保存在這個瀏覽器。
      </p>
    </div>
  </section>
</template>

<route lang="json">
{
  "name": "login",
  "path": "/login",
  "meta": {
    "public": true
  }
}
</route>
