<script setup>
import { ArrowRight, X } from 'lucide-vue-next';

const store = useAppStore();
const router = useRouter();
const badgeViewer = ref(null);
const selectedBadge = computed(() => store.state.badgeViewerQueue[0] || null);
const confettiColors = ['#2777c8', '#ef7290', '#f6bd2e', '#65a86d', '#ee7946', '#fffdf6'];
const confettiPieces = Array.from({ length: 42 }, (_, index) => {
  const angle = (index / 42) * Math.PI * 2;
  const distance = 124 + (index % 7) * 18;
  return {
    id: index,
    style: {
      '--confetti-color': confettiColors[index % confettiColors.length],
      '--confetti-x': `${Math.cos(angle) * distance}px`,
      '--confetti-y': `${Math.sin(angle) * distance + (index % 4) * 11}px`,
      '--confetti-rotate': `${(index % 2 ? 1 : -1) * (180 + index * 19)}deg`,
      '--confetti-delay': `${(index % 6) * 18}ms`,
      '--confetti-width': `${6 + (index % 3) * 2}px`,
      '--confetti-height': `${10 + (index % 4) * 3}px`,
    },
  };
});

const close = () => store.closeBadgeViewer();
const goToCard = () => {
  close();
  router.push('/card');
};

watch(
  selectedBadge,
  async (badge) => {
    document.body.classList.toggle('dialog-open', Boolean(badge));
    if (badge) {
      await nextTick();
      badgeViewer.value?.focus();
    }
  },
  { immediate: true }
);
onBeforeUnmount(() => document.body.classList.remove('dialog-open'));
</script>

<template>
  <Teleport to="body">
    <Transition name="badge-viewer">
      <div v-if="selectedBadge" class="badge-viewer-backdrop" @click.self="close">
        <section
          ref="badgeViewer"
          class="badge-viewer"
          role="dialog"
          aria-modal="true"
          aria-labelledby="badge-viewer-title"
          tabindex="-1"
          @keydown.esc="close"
        >
          <button class="badge-viewer-close" type="button" aria-label="關閉徽章詳情" @click="close">
            <X :size="22" />
          </button>
          <div class="badge-viewer-inner">
            <p class="badge-viewer-kicker">
              {{ selectedBadge.mode === 'earned' ? 'BADGE UNLOCKED' : 'BADGE NOTE' }}
            </p>
            <div class="badge-medallion-stage">
              <div :class="['badge-viewer-medallion', { locked: !selectedBadge.unlocked }]">
                <img :src="selectedBadge.src" :alt="selectedBadge.alt" />
                <strong v-if="!selectedBadge.unlocked" aria-hidden="true">?</strong>
              </div>
              <div v-if="selectedBadge.mode === 'earned'" class="badge-confetti" aria-hidden="true">
                <i
                  v-for="piece in confettiPieces"
                  :key="piece.id"
                  class="badge-confetti-piece"
                  :style="piece.style"
                ></i>
              </div>
            </div>
            <p class="badge-viewer-series">{{ selectedBadge.seriesLabel }}</p>
            <h2 id="badge-viewer-title">達成 {{ selectedBadge.threshold }} 次</h2>
            <p v-if="selectedBadge.mode === 'earned'" class="badge-viewer-status">
              恭喜你！剛剛完成第 {{ selectedBadge.threshold }} 次，解鎖了這枚徽章。
            </p>
            <p v-else-if="!selectedBadge.unlocked" class="badge-viewer-status">
              再完成
              {{ Math.max(selectedBadge.threshold - selectedBadge.current, 0) }}
              次，就能解鎖這枚徽章。
            </p>
            <div class="badge-viewer-note">
              <span>{{ selectedBadge.mode === 'earned' ? 'KEEP GOING!' : 'SOSOBOOK BADGE' }}</span>
              <small>每一次紀錄，都是貼在手帳上的小小進步。</small>
            </div>
            <button
              v-if="selectedBadge.mode === 'earned'"
              class="badge-viewer-card-link"
              type="button"
              @click="goToCard"
            >
              前往會員卡查看 <ArrowRight :size="18" />
            </button>
          </div>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>
