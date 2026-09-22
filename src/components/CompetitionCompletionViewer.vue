<script setup>
import { ArrowRight, Trophy, X } from 'lucide-vue-next';

const store = useAppStore();
const router = useRouter();
const viewer = ref(null);
const selectedCompetition = computed(() => store.state.competitionCompletionQueue[0] || null);

const close = () => store.closeCompetitionCompletion();
const goToResult = () => {
  const competitionId = selectedCompetition.value?.id;
  close();
  if (competitionId) router.push(`/competitions/${competitionId}`);
};

watch(
  selectedCompetition,
  async (competition) => {
    document.body.classList.toggle('dialog-open', Boolean(competition));
    if (competition) {
      await nextTick();
      viewer.value?.focus();
    }
  },
  { immediate: true }
);
onBeforeUnmount(() => document.body.classList.remove('dialog-open'));
</script>

<template>
  <Teleport to="body">
    <Transition name="competition-completion">
      <div v-if="selectedCompetition" class="competition-completion-backdrop" @click.self="close">
        <section
          ref="viewer"
          class="competition-completion-viewer"
          role="dialog"
          aria-modal="true"
          aria-labelledby="competition-completion-title"
          tabindex="-1"
          @keydown.esc="close"
        >
          <button
            class="competition-completion-close"
            type="button"
            aria-label="關閉競賽完成提示"
            @click="close"
          >
            <X :size="22" />
          </button>
          <div class="competition-completion-inner">
            <p class="competition-completion-kicker">RACE COMPLETE</p>
            <div class="competition-completion-medallion" aria-hidden="true">
              <Trophy :size="72" stroke-width="1.8" />
            </div>
            <p class="competition-completion-label">競賽已完成</p>
            <h2 id="competition-completion-title">
              「{{ selectedCompetition.name }}」<br />已完賽
            </h2>
            <p class="competition-completion-message">
              結果已正式結算，要看看你的名次與比賽期間曲線嗎？
            </p>
            <div class="competition-completion-note">
              <span>RACE NOTE</span>
              <small>每一次參賽，都是留在手帳上的一頁成績。</small>
            </div>
            <div class="competition-completion-actions">
              <button type="button" class="competition-completion-later" @click="close">
                稍後查看
              </button>
              <button type="button" class="competition-completion-primary" @click="goToResult">
                查看結果 <ArrowRight :size="18" />
              </button>
            </div>
          </div>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>
