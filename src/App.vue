<script setup>
const store = useAppStore();
const router = useRouter();
const route = useRoute();
let unsubscribe;

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
});
onBeforeUnmount(() => unsubscribe?.());
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
  <div v-if="!store.state.authReady" class="splash">
    <div class="loader"></div>
    <p>正在翻開手帳…</p>
  </div>
  <AppShell v-else><RouterView /></AppShell>
  <ToastNotice />
  <ConfirmDialog />
  <BadgeViewer />
</template>
