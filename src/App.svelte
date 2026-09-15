<script lang="ts">
  import Home from './pages/Home.svelte';
  import Manage from './pages/Manage.svelte';
  import { router } from './lib/router.svelte';
</script>

{#if router.route.name === 'home'}
  <Home />
{:else}
  <Manage />
{/if}
