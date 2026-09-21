<script setup>
import { ArrowLeft, ChevronDown, X } from 'lucide-vue-next';
import settingsFaq from '@/data/settings-faq.json';

const router = useRouter();
const openFaqId = ref(null);
const close = () => router.push('/setting');
const toggleFaq = (id) => {
  openFaqId.value = openFaqId.value === id ? null : id;
};
</script>

<template>
  <section class="settings-page">
    <div class="settings-page-inner">
      <header class="settings-page-header">
        <button class="settings-close" type="button" aria-label="返回設定" @click="close">
          <X :size="22" />
        </button>
        <p class="eyebrow">HOW TO USE</p>
        <h1>使用說明</h1>
      </header>

      <section class="settings-block settings-guide" aria-labelledby="settings-guide-title">
        <div class="settings-faq-list">
          <article
            v-for="item in settingsFaq"
            :key="item.id"
            :class="['settings-faq-item', { open: openFaqId === item.id }]"
          >
            <button
              class="settings-faq-question"
              type="button"
              :aria-expanded="openFaqId === item.id"
              :aria-controls="`faq-answer-${item.id}`"
              @click="toggleFaq(item.id)"
            >
              <span>{{ item.question }}</span>
              <ChevronDown :size="19" aria-hidden="true" />
            </button>
            <div
              v-if="openFaqId === item.id"
              :id="`faq-answer-${item.id}`"
              class="settings-faq-answer"
            >
              <p v-if="item.answer">{{ item.answer }}</p>
              <ol v-if="item.steps" class="settings-faq-steps">
                <li v-for="step in item.steps" :key="step">{{ step }}</li>
              </ol>
            </div>
          </article>
        </div>
      </section>

      <RouterLink class="settings-back-link" to="/setting"
        ><ArrowLeft :size="17" />回到設定</RouterLink
      >
    </div>
  </section>
</template>

<route lang="json">
{
  "name": "setting-guide",
  "path": "/setting/guide"
}
</route>
