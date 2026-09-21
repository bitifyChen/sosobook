<script setup>
import { ArrowLeft } from 'lucide-vue-next';
import { avatars } from '@/data/assets';

const store = useAppStore();
const route = useRoute();
const router = useRouter();
const isEditing = computed(() => route.query.mode === 'edit');
const form = reactive({
  nickname: store.state.profile?.nickname || store.state.user?.displayName || '',
  heightCm: store.state.profile?.heightCm || 165,
  avatarId: store.state.profile?.avatarId || avatars[0].id,
});
const error = ref('');
watch(
  () => store.state.profile,
  (profile) => {
    if (profile) Object.assign(form, profile);
  },
  { immediate: true }
);
const submit = async () => {
  error.value = '';
  try {
    await store.saveProfile(form);
    router.replace(isEditing.value ? '/card' : '/');
  } catch (cause) {
    error.value =
      cause?.code === 'permission-denied'
        ? '會員卡資料被 Firebase Rules 擋下，請先重新部署最新規則。'
        : cause?.code === 'failed-precondition'
          ? 'Firestore 索引正在建立中，請稍候再試。'
          : cause?.message || '目前無法保存會員卡，請稍後再試。';
  }
};
</script>

<template>
  <section class="page-section narrow-page">
    <header class="page-header centered">
      <RouterLink v-if="isEditing" class="back-button onboarding-back" to="/card">
        <ArrowLeft />返回會員卡
      </RouterLink>
      <p class="eyebrow">{{ isEditing ? '會員卡設定' : '第一步' }}</p>
      <h1>{{ isEditing ? '編輯運動會員卡' : '拍張運動會員卡' }}</h1>
      <p>
        {{
          isEditing
            ? '調整人物、暱稱與身高，保存後就會同步到你的健身卡。'
            : '這個人物會陪你出現在排行榜與健身卡上。'
        }}
      </p>
    </header>
    <form class="paper-card form-card" @submit.prevent="submit">
      <div class="avatar-grid">
        <label
          v-for="avatar in avatars"
          :key="avatar.id"
          :class="['avatar-option', { selected: form.avatarId === avatar.id }]"
        >
          <input v-model="form.avatarId" type="radio" :value="avatar.id" /><img
            :src="avatar.src"
            :alt="avatar.alt"
          />
        </label>
      </div>
      <label class="field"
        ><span>你的暱稱</span
        ><input v-model.trim="form.nickname" maxlength="16" required placeholder="例如：慢跑小晴"
      /></label>
      <label class="field"
        ><span>身高（cm）</span
        ><input v-model.number="form.heightCm" type="number" min="100" max="230" required
      /></label>
      <p v-if="error" class="form-error">{{ error }}</p>
      <button class="primary-button" :disabled="store.state.busy">
        {{ isEditing ? '保存會員卡' : '開始寫手帳' }}
      </button>
    </form>
  </section>
</template>

<route lang="json">
{
  "name": "welcome",
  "path": "/welcome"
}
</route>
