<script setup>
import { ArrowLeft } from 'lucide-vue-next';

const router = useRouter();
</script>

<template>
  <section class="page-section">
    <header class="page-header competition-history-header">
      <button class="back-button" @click="router.back()"><ArrowLeft />返回</button>
      <div>
        <p class="eyebrow">COMPETITION HISTORY</p>
        <h1>競賽歷史</h1>
        <p>完賽結果收進這本紀錄冊。</p>
      </div>
    </header>
    <CompetitionList :history="true" />
  </section>
</template>

<route lang="json">
{
  "name": "competition-history",
  "path": "/competitions/history"
}
</route>
