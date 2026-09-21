<script setup>
import { navAssets } from '@/data/assets';

const route = useRoute();
const isPublic = computed(
  () => route.name === 'login' || route.name === 'welcome' || route.path.startsWith('/setting')
);
const showCheckInFab = computed(() => !isPublic.value && route.name !== 'check-in');
const navItems = [
  { to: '/', label: '日曆', image: navAssets.calendar, names: ['calendar'] },
  {
    to: '/competitions',
    label: '競賽',
    image: navAssets.competition,
    names: [
      'competitions',
      'competition-new',
      'competition-join',
      'competition-edit',
      'competition-detail',
    ],
  },
  { to: '/card', label: '健身卡', image: navAssets.card, names: ['card'] },
];
</script>

<template>
  <main :class="['app-frame', { 'app-frame--public': isPublic }]">
    <div class="page-wrap"><slot /></div>
    <nav v-if="!isPublic" class="bottom-nav" aria-label="主要導覽">
      <RouterLink
        v-for="item in navItems"
        :key="item.to"
        :to="item.to"
        :class="{ active: item.names.includes(route.name) }"
      >
        <img :src="item.image" alt="" /><span>{{ item.label }}</span>
      </RouterLink>
    </nav>
    <CheckInFab v-if="showCheckInFab" />
  </main>
</template>
