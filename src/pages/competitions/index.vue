<script setup>
import { History, Plus, Ticket } from 'lucide-vue-next';
</script>

<template>
  <section class="page-section">
    <header class="page-header split-header competition-list-header">
      <div>
        <p class="eyebrow">PARTY WELLNESS</p>
        <h1>一起加油吧</h1>
        <p>可參加多場競賽，彼此加油。</p>
      </div>
      <div class="competition-list-header-actions">
        <div class="header-doodle">GO!</div>
        <RouterLink
          class="round-button competition-history-button"
          to="/competitions/history"
          aria-label="競賽歷史紀錄"
          title="競賽歷史紀錄"
        >
          <History :size="19" />
        </RouterLink>
      </div>
    </header>
    <div class="action-pair">
      <RouterLink class="primary-button" to="/competitions/new"><Plus />建立競賽</RouterLink
      ><RouterLink class="secondary-button" to="/competitions/join"
        ><Ticket />輸入邀請碼</RouterLink
      >
    </div>
    <CompetitionList />
  </section>
</template>

<route lang="json">
{
  "name": "competitions",
  "path": "/competitions"
}
</route>
