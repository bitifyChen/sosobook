<script setup>
import { ArrowLeft, ArrowRight, BookOpen, LogOut, X } from 'lucide-vue-next';

const store = useAppStore();
const router = useRouter();

const logout = async () => {
  const confirmed = await store.askConfirm({
    tone: 'danger',
    title: '要先收好這本手帳嗎？',
    message: '登出後可以再次登入，今天的體重與貼紙紀錄都不會遺失。',
    confirmText: '確認登出',
    cancelText: '留在手帳裡',
  });
  if (confirmed) await store.logout();
};

const close = () => router.push('/card');
</script>

<template>
  <section class="settings-page">
    <div class="settings-page-inner">
      <header class="settings-page-header">
        <button class="settings-close" type="button" aria-label="返回健身卡" @click="close">
          <X :size="22" />
        </button>
        <h1>設定</h1>
      </header>

      <section class="settings-menu" aria-label="設定功能">
        <RouterLink class="settings-menu-item" to="/setting/guide">
          <span class="settings-icon"><BookOpen :size="20" /></span>
          <span class="settings-menu-copy">
            <strong>使用說明</strong>
            <small>看看 SosoBook 的使用方式</small>
          </span>
          <ArrowRight :size="20" />
        </RouterLink>
        <RouterLink class="settings-menu-item" to="/setting/account">
          <span class="google-mark">G</span>
          <span class="settings-menu-copy">
            <strong>帳號綁定</strong>
            <small>查看目前登入的 Google 帳號</small>
          </span>
          <ArrowRight :size="20" />
        </RouterLink>
      </section>

      <button class="settings-logout" type="button" @click="logout">
        <LogOut :size="19" />登出這本手帳
      </button>
      <RouterLink class="settings-back-link" to="/card"
        ><ArrowLeft :size="17" />回到健身卡</RouterLink
      >
    </div>
  </section>
</template>

<route lang="json">
{
  "name": "setting",
  "path": "/setting"
}
</route>
