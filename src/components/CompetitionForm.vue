<script setup>
import { ArrowLeft, CalendarDays, KeyRound } from 'lucide-vue-next';
import { addDays, toDateKey } from '@/utils/date';

const store = useAppStore();
const route = useRoute();
const router = useRouter();
const joining = computed(() => route.name === 'competition-join');
const editing = computed(() => route.name === 'competition-edit');
const item = computed(() =>
  store.state.competitions.find((competition) => competition.id === route.params.id)
);
const today = toDateKey();
const form = reactive({ name: '', startDate: today, endDate: addDays(today, 30), code: '' });
const error = ref('');
const competitionClosed = computed(
  () =>
    editing.value &&
    Boolean(item.value) &&
    (item.value.status === 'settled' || item.value.endDate < today)
);
const datesLocked = computed(
  () => editing.value && Boolean(item.value) && item.value.startDate <= today
);
const formDescription = computed(() => {
  if (joining.value) return '輸入朋友分享的六碼邀請碼。';
  if (editing.value) {
    if (competitionClosed.value) return '這場競賽已結束，設定已鎖定。';
    if (datesLocked.value) return '競賽已開始，現在只能修改名稱；開始與結束日期已鎖定。';
    return '調整名稱或日期，已加入的成員與邀請碼會保留。';
  }
  return '現在就可以開一場競賽；有開始日體重的成員，才會列入暫算排名。';
});
watch(
  item,
  (value) => {
    if (value && editing.value) {
      form.name = value.name;
      form.startDate = value.startDate;
      form.endDate = value.endDate;
    }
  },
  { immediate: true }
);
const submit = async () => {
  error.value = '';
  try {
    const result = joining.value
      ? await store.joinCompetition(form.code)
      : editing.value
        ? await store.updateCompetition(route.params.id, form)
        : await store.createCompetition(form);
    let destination = `/competitions/${result.id}`;
    if (joining.value && result.joinPrompt) {
      const shouldContinue = await store.askConfirm({
        title: result.joinPrompt.kind === 'first-day' ? '加入成功！今天是競賽第一天' : '加入成功！',
        message:
          result.joinPrompt.kind === 'first-day'
            ? '今天的資料尚未打卡，要現在前往填寫嗎？'
            : `您有 ${result.joinPrompt.missingDays} 天的資料尚未填寫，可以在競賽期間前往日曆補記。要現在查看日曆嗎？`,
        confirmText: result.joinPrompt.kind === 'first-day' ? '前往填寫' : '前往日曆',
        cancelText: '離開',
      });
      if (shouldContinue) {
        destination = result.joinPrompt.kind === 'first-day' ? '/check-in' : '/';
      }
    }
    await router.replace(destination);
  } catch (cause) {
    if (cause?.code === 'permission-denied' || cause?.code === 'PERMISSION_DENIED') {
      error.value = competitionClosed.value
        ? '這場競賽已結束，無法再編輯。'
        : datesLocked.value
          ? '競賽已開始，日期已鎖定；目前只能修改挑戰名稱。'
          : '目前沒有權限修改這場競賽，請確認你是主辦人。';
    } else {
      error.value = cause.message || '暫時無法完成，請稍後再試。';
    }
  }
};
</script>

<template>
  <section class="page-section narrow-page">
    <header class="page-header">
      <button class="back-button" @click="router.back()"><ArrowLeft />返回</button>
      <p class="eyebrow">
        {{ joining ? 'JOIN A PARTY' : editing ? 'EDIT PARTY' : 'NEW PARTY' }}
      </p>
      <h1>{{ joining ? '加入朋友的挑戰' : editing ? '編輯挑戰' : '舉辦挑戰' }}</h1>
      <p>
        {{ formDescription }}
      </p>
    </header>
    <form class="paper-card form-card" @submit.prevent="submit">
      <template v-if="joining"
        ><label class="field code-field"
          ><span><KeyRound />邀請碼</span
          ><input
            v-model.trim="form.code"
            maxlength="6"
            minlength="6"
            required
            placeholder="ABCDEF"
            @input="form.code = form.code.toUpperCase()" /></label
      ></template>
      <template v-else>
        <label :class="['field', { 'field--locked': competitionClosed }]"
          ><span>挑戰名稱</span
          ><input
            v-model.trim="form.name"
            maxlength="24"
            required
            placeholder="例如：夏日活力盃"
            :disabled="competitionClosed"
        /></label>
        <div class="date-fields">
          <label :class="['field', { 'field--locked': datesLocked }]"
            ><span><CalendarDays />開始日期</span
            ><input v-model="form.startDate" type="date" required :disabled="datesLocked" /></label
          ><label :class="['field', { 'field--locked': datesLocked }]"
            ><span><CalendarDays />結束日期</span
            ><input
              v-model="form.endDate"
              type="date"
              :min="form.startDate"
              required
              :disabled="datesLocked"
          /></label>
        </div>
      </template>
      <p v-if="error" class="form-error">{{ error }}</p>
      <button
        class="primary-button"
        :disabled="store.state.busy || (editing && (!item || competitionClosed))"
      >
        {{ joining ? '加入挑戰' : editing ? '保存挑戰設定' : '建立並取得邀請碼' }}
      </button>
    </form>
  </section>
</template>
