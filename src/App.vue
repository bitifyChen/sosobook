<script setup>
const store = useAppStore();
const router = useRouter();
const route = useRoute();
let unsubscribe;
let competitionRefreshTimer;

const refreshCompetitionsOnResume = () => {
  if (document.visibilityState !== 'visible' || !store.state.authReady || !store.state.user) return;
  void store.refreshCompetitions({ notifyOnIndexPending: false }).catch((cause) => {
    console.warn('[SosoBook] 回到前景後競賽同步失敗。', cause);
  });
};

const routeForState = () => {
  if (!store.state.authReady) return;
  if (store.state.loginPending) return;
  if (store.state.authError) {
    if (route.name !== 'login') router.replace('/login');
    return;
  }
  if (!store.state.user && !route.meta.public) router.replace('/login');
  else if (store.state.user && !store.state.profile && route.name !== 'welcome')
    router.replace('/welcome');
  else if (
    store.state.user &&
    store.state.profile &&
    (route.name === 'login' || (route.name === 'welcome' && route.query.mode !== 'edit'))
  )
    router.replace('/');
};

onMounted(() => {
  unsubscribe = store.init();
  document.addEventListener('visibilitychange', refreshCompetitionsOnResume);
  window.addEventListener('pageshow', refreshCompetitionsOnResume);
  window.addEventListener('online', refreshCompetitionsOnResume);
  competitionRefreshTimer = window.setInterval(refreshCompetitionsOnResume, 5 * 60 * 1000);
});
onBeforeUnmount(() => {
  unsubscribe?.();
  document.removeEventListener('visibilitychange', refreshCompetitionsOnResume);
  window.removeEventListener('pageshow', refreshCompetitionsOnResume);
  window.removeEventListener('online', refreshCompetitionsOnResume);
  window.clearInterval(competitionRefreshTimer);
});
watch(
  () => [
    store.state.authReady,
    store.state.loginPending,
    store.state.user,
    store.state.profile,
    store.state.authError,
    route.fullPath,
  ],
  routeForState,
  { deep: true }
);
</script>

<template>
  <div class="app-viewport">
    <div v-if="!store.state.authReady" class="splash">
      <div class="splash-progress" role="progressbar" aria-label="正在載入 SosoBook">
        <span></span>
      </div>
      <p>正在翻開手帳…</p>
    </div>
    <AppShell v-else><RouterView /></AppShell>
  </div>
  <ToastNotice />
  <ConfirmDialog />
  <CompetitionCompletionViewer />
  <BadgeViewer />
  <PwaInstallPrompt />
</template>
