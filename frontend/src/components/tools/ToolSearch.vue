<template>
  <div class="tool-search">
    <t-input
      v-model="searchQuery"
      :placeholder="placeholder"
      size="large"
      clearable
      @change="handleSearch"
      @enter="handleSearch"
      @clear="handleClear"
    >
      <template #prefix-icon>
        <search-icon />
      </template>
      
      <template #suffix>
        <t-button
          variant="text"
          size="small"
          @click="toggleAdvancedSearch"
        >
          <filter-icon />
        </t-button>
      </template>
    </t-input>

    <!-- 搜索建议 -->
    <div v-if="showSuggestions && suggestions.length > 0" class="search-suggestions">
      <div class="suggestions-header">
        <span class="suggestions-title">搜索建议</span>
        <t-button
          variant="text"
          size="small"
          @click="closeSuggestions"
        >
          <close-icon />
        </t-button>
      </div>
      
      <div class="suggestions-list">
        <div
          v-for="(suggestion, index) in suggestions"
          :key="index"
          class="suggestion-item"
          :class="{ active: selectedSuggestionIndex === index }"
          @click="selectSuggestion(suggestion)"
          @mouseenter="selectedSuggestionIndex = index"
        >
          <div class="suggestion-content">
            <div class="suggestion-text">
              <span v-html="highlightMatch(suggestion.text, searchQuery)"></span>
            </div>
            <div class="suggestion-meta">
              <t-tag size="small" variant="outline">
                {{ suggestion.type }}
              </t-tag>
              <span class="suggestion-count">{{ suggestion.count }} 个结果</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 高级搜索面板 -->
    <t-drawer
      v-model:visible="showAdvancedSearch"
      title="高级搜索"
      size="400px"
      placement="right"
    >
      <div class="advanced-search-content">
        <!-- 搜索范围 -->
        <div class="search-section">
          <h4 class="section-title">搜索范围</h4>
          <t-checkbox-group v-model="searchScope">
            <t-checkbox value="name">工具名称</t-checkbox>
            <t-checkbox value="description">工具描述</t-checkbox>
            <t-checkbox value="server">服务器名称</t-checkbox>
            <t-checkbox value="schema">参数定义</t-checkbox>
          </t-checkbox-group>
        </div>

        <!-- 搜索条件 -->
        <div class="search-section">
          <h4 class="section-title">搜索条件</h4>
          
          <div class="search-condition">
            <label class="condition-label">匹配模式</label>
            <t-radio-group v-model="matchMode">
              <t-radio value="fuzzy">模糊匹配</t-radio>
              <t-radio value="exact">精确匹配</t-radio>
              <t-radio value="regex">正则表达式</t-radio>
            </t-radio-group>
          </div>

          <div class="search-condition">
            <label class="condition-label">大小写敏感</label>
            <t-switch v-model="caseSensitive" />
          </div>

          <div class="search-condition">
            <label class="condition-label">全词匹配</label>
            <t-switch v-model="wholeWord" />
          </div>
        </div>

        <!-- 搜索历史 -->
        <div v-if="searchHistory.length > 0" class="search-section">
          <h4 class="section-title">
            搜索历史
            <t-button
              variant="text"
              size="small"
              @click="clearSearchHistory"
            >
              清空
            </t-button>
          </h4>
          
          <div class="search-history">
            <t-tag
              v-for="(item, index) in searchHistory"
              :key="index"
              variant="outline"
              closable
              clickable
              @click="selectHistoryItem(item)"
              @close="removeHistoryItem(index)"
            >
              {{ item }}
            </t-tag>
          </div>
        </div>

        <!-- 保存的搜索 -->
        <div v-if="savedSearches.length > 0" class="search-section">
          <h4 class="section-title">保存的搜索</h4>
          
          <div class="saved-searches">
            <div
              v-for="search in savedSearches"
              :key="search.id"
              class="saved-search-item"
            >
              <div class="saved-search-content">
                <div class="saved-search-name">{{ search.name }}</div>
                <div class="saved-search-query">{{ search.query }}</div>
              </div>
              <div class="saved-search-actions">
                <t-button
                  variant="text"
                  size="small"
                  @click="loadSavedSearch(search)"
                >
                  使用
                </t-button>
                <t-button
                  variant="text"
                  size="small"
                  theme="danger"
                  @click="deleteSavedSearch(search)"
                >
                  删除
                </t-button>
              </div>
            </div>
          </div>
        </div>

        <!-- 操作按钮 -->
        <div class="search-actions">
          <t-space direction="vertical" size="small">
            <t-button
              theme="primary"
              block
              @click="performAdvancedSearch"
            >
              执行搜索
            </t-button>
            
            <t-button
              variant="outline"
              block
              @click="saveCurrentSearch"
            >
              保存当前搜索
            </t-button>
            
            <t-button
              variant="text"
              block
              @click="resetAdvancedSearch"
            >
              重置搜索条件
            </t-button>
          </t-space>
        </div>
      </div>
    </t-drawer>

    <!-- 搜索结果统计 -->
    <div v-if="searchQuery && searchResults" class="search-results-info">
      <span class="results-count">
        找到 {{ searchResults.total }} 个结果
      </span>
      <span v-if="searchResults.executionTime" class="execution-time">
        ({{ searchResults.executionTime }}ms)
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue';
import {
  SearchIcon,
  FilterIcon,
  CloseIcon,
} from 'tdesign-icons-vue-next';
import { MessagePlugin, DialogPlugin } from 'tdesign-vue-next';
import { useToolStore } from '@/stores/tool';

// Props
interface Props {
  placeholder?: string;
  modelValue?: string;
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: '搜索工具名称、描述或服务器...',
  modelValue: '',
});

// Emits
const emit = defineEmits<{
  'update:modelValue': [value: string];
  'search': [query: string, options?: any];
  'clear': [];
}>();

// Store
const toolStore = useToolStore();

// 响应式数据
const searchQuery = ref(props.modelValue);
const showSuggestions = ref(false);
const selectedSuggestionIndex = ref(-1);
const showAdvancedSearch = ref(false);

// 高级搜索选项
const searchScope = ref(['name', 'description']);
const matchMode = ref<'fuzzy' | 'exact' | 'regex'>('fuzzy');
const caseSensitive = ref(false);
const wholeWord = ref(false);

// 搜索历史和保存的搜索
const searchHistory = ref<string[]>([]);
const savedSearches = ref<Array<{
  id: string;
  name: string;
  query: string;
  options: any;
}>>([]);

// 搜索结果
const searchResults = ref<{
  total: number;
  executionTime?: number;
} | null>(null);

// 计算属性
const suggestions = computed(() => {
  if (!searchQuery.value || searchQuery.value.length < 2) {
    return [];
  }

  const query = searchQuery.value.toLowerCase();
  const suggestions = [];

  // 工具名称建议
  const toolNames = toolStore.toolList
    .filter(tool => tool.name.toLowerCase().includes(query))
    .slice(0, 5);
  
  if (toolNames.length > 0) {
    suggestions.push({
      text: `工具名称包含 "${searchQuery.value}"`,
      type: '工具名称',
      count: toolNames.length,
      action: () => performSearch(`name:${searchQuery.value}`),
    });
  }

  // 服务器建议
  const servers = toolStore.serverList
    .filter(server => server.toLowerCase().includes(query))
    .slice(0, 3);
  
  if (servers.length > 0) {
    suggestions.push({
      text: `服务器包含 "${searchQuery.value}"`,
      type: '服务器',
      count: servers.length,
      action: () => performSearch(`server:${searchQuery.value}`),
    });
  }

  // 描述建议
  const descriptionMatches = toolStore.toolList
    .filter(tool => tool.description?.toLowerCase().includes(query))
    .slice(0, 3);
  
  if (descriptionMatches.length > 0) {
    suggestions.push({
      text: `描述包含 "${searchQuery.value}"`,
      type: '描述',
      count: descriptionMatches.length,
      action: () => performSearch(`description:${searchQuery.value}`),
    });
  }

  return suggestions;
});

// 方法
const handleSearch = () => {
  if (searchQuery.value.trim()) {
    addToHistory(searchQuery.value);
    performSearch(searchQuery.value);
  }
  closeSuggestions();
};

const handleClear = () => {
  searchQuery.value = '';
  searchResults.value = null;
  emit('update:modelValue', '');
  emit('clear');
};

const performSearch = (query: string) => {
  const startTime = Date.now();
  
  // 执行搜索逻辑
  const options = {
    scope: searchScope.value,
    matchMode: matchMode.value,
    caseSensitive: caseSensitive.value,
    wholeWord: wholeWord.value,
  };

  emit('search', query, options);
  
  // 模拟搜索结果统计
  const executionTime = Date.now() - startTime;
  searchResults.value = {
    total: toolStore.filteredTools.length,
    executionTime,
  };

  emit('update:modelValue', query);
};

const toggleAdvancedSearch = () => {
  showAdvancedSearch.value = !showAdvancedSearch.value;
};

const closeSuggestions = () => {
  showSuggestions.value = false;
  selectedSuggestionIndex.value = -1;
};

const selectSuggestion = (suggestion: any) => {
  suggestion.action();
  closeSuggestions();
};

const highlightMatch = (text: string, query: string) => {
  if (!query) return text;
  
  const regex = new RegExp(`(${query})`, 'gi');
  return text.replace(regex, '<mark>$1</mark>');
};

const performAdvancedSearch = () => {
  if (searchQuery.value.trim()) {
    performSearch(searchQuery.value);
    showAdvancedSearch.value = false;
  }
};

const saveCurrentSearch = async () => {
  if (!searchQuery.value.trim()) {
    MessagePlugin.warning('请输入搜索内容');
    return;
  }

  const name = await DialogPlugin.prompt({
    header: '保存搜索',
    body: '请输入搜索名称',
    confirmBtn: '保存',
    cancelBtn: '取消',
  });

  if (name) {
    const search = {
      id: Date.now().toString(),
      name,
      query: searchQuery.value,
      options: {
        scope: searchScope.value,
        matchMode: matchMode.value,
        caseSensitive: caseSensitive.value,
        wholeWord: wholeWord.value,
      },
    };

    savedSearches.value.push(search);
    saveSavedSearchesToStorage();
    MessagePlugin.success('搜索已保存');
  }
};

const loadSavedSearch = (search: any) => {
  searchQuery.value = search.query;
  searchScope.value = search.options.scope;
  matchMode.value = search.options.matchMode;
  caseSensitive.value = search.options.caseSensitive;
  wholeWord.value = search.options.wholeWord;
  
  performSearch(search.query);
  showAdvancedSearch.value = false;
};

const deleteSavedSearch = async (search: any) => {
  const confirmed = await DialogPlugin.confirm({
    header: '删除保存的搜索',
    body: `确定要删除 "${search.name}" 吗？`,
    confirmBtn: '删除',
    cancelBtn: '取消',
  });

  if (confirmed) {
    const index = savedSearches.value.findIndex(s => s.id === search.id);
    if (index > -1) {
      savedSearches.value.splice(index, 1);
      saveSavedSearchesToStorage();
      MessagePlugin.success('已删除');
    }
  }
};

const resetAdvancedSearch = () => {
  searchScope.value = ['name', 'description'];
  matchMode.value = 'fuzzy';
  caseSensitive.value = false;
  wholeWord.value = false;
};

const addToHistory = (query: string) => {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) return;

  // 移除重复项
  const index = searchHistory.value.indexOf(trimmedQuery);
  if (index > -1) {
    searchHistory.value.splice(index, 1);
  }

  // 添加到开头
  searchHistory.value.unshift(trimmedQuery);

  // 限制历史记录数量
  if (searchHistory.value.length > 10) {
    searchHistory.value = searchHistory.value.slice(0, 10);
  }

  saveHistoryToStorage();
};

const selectHistoryItem = (item: string) => {
  searchQuery.value = item;
  performSearch(item);
  showAdvancedSearch.value = false;
};

const removeHistoryItem = (index: number) => {
  searchHistory.value.splice(index, 1);
  saveHistoryToStorage();
};

const clearSearchHistory = () => {
  searchHistory.value = [];
  saveHistoryToStorage();
  MessagePlugin.success('搜索历史已清空');
};

const saveHistoryToStorage = () => {
  localStorage.setItem('tool-search-history', JSON.stringify(searchHistory.value));
};

const loadHistoryFromStorage = () => {
  const saved = localStorage.getItem('tool-search-history');
  if (saved) {
    try {
      searchHistory.value = JSON.parse(saved);
    } catch (err) {
      console.error('Failed to load search history:', err);
    }
  }
};

const saveSavedSearchesToStorage = () => {
  localStorage.setItem('tool-saved-searches', JSON.stringify(savedSearches.value));
};

const loadSavedSearchesFromStorage = () => {
  const saved = localStorage.getItem('tool-saved-searches');
  if (saved) {
    try {
      savedSearches.value = JSON.parse(saved);
    } catch (err) {
      console.error('Failed to load saved searches:', err);
    }
  }
};

// 键盘事件处理
const handleKeydown = (event: KeyboardEvent) => {
  if (!showSuggestions.value || suggestions.value.length === 0) return;

  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault();
      selectedSuggestionIndex.value = Math.min(
        selectedSuggestionIndex.value + 1,
        suggestions.value.length - 1
      );
      break;
    case 'ArrowUp':
      event.preventDefault();
      selectedSuggestionIndex.value = Math.max(
        selectedSuggestionIndex.value - 1,
        -1
      );
      break;
    case 'Enter':
      event.preventDefault();
      if (selectedSuggestionIndex.value >= 0) {
        selectSuggestion(suggestions.value[selectedSuggestionIndex.value]);
      } else {
        handleSearch();
      }
      break;
    case 'Escape':
      closeSuggestions();
      break;
  }
};

// 监听搜索查询变化
watch(searchQuery, (newValue) => {
  if (newValue.length >= 2) {
    showSuggestions.value = true;
  } else {
    closeSuggestions();
  }
});

// 监听props变化
watch(
  () => props.modelValue,
  (newValue) => {
    searchQuery.value = newValue;
  }
);

// 组件挂载时加载数据
onMounted(() => {
  loadHistoryFromStorage();
  loadSavedSearchesFromStorage();
  
  // 添加键盘事件监听
  document.addEventListener('keydown', handleKeydown);
});

// 组件卸载时移除事件监听
onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown);
});
</script>

<style scoped>
.tool-search {
  position: relative;
}

.search-suggestions {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  z-index: 1000;
  background: var(--td-bg-color-container);
  border: 1px solid var(--td-border-level-1-color);
  border-radius: var(--td-radius-default);
  box-shadow: var(--td-shadow-2);
  margin-top: 4px;
}

.suggestions-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  border-bottom: 1px solid var(--td-border-level-1-color);
}

.suggestions-title {
  font-size: 12px;
  color: var(--td-text-color-secondary);
}

.suggestions-list {
  max-height: 200px;
  overflow-y: auto;
}

.suggestion-item {
  padding: 8px 12px;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.suggestion-item:hover,
.suggestion-item.active {
  background: var(--td-bg-color-container-hover);
}

.suggestion-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.suggestion-text {
  font-size: 14px;
}

.suggestion-meta {
  display: flex;
  align-items: center;
  gap: 8px;
}

.suggestion-count {
  font-size: 12px;
  color: var(--td-text-color-secondary);
}

.advanced-search-content {
  padding: 16px 0;
}

.search-section {
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--td-border-level-1-color);
}

.search-section:last-child {
  border-bottom: none;
  margin-bottom: 0;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.search-condition {
  margin-bottom: 16px;
}

.condition-label {
  display: block;
  font-size: 12px;
  color: var(--td-text-color-secondary);
  margin-bottom: 4px;
}

.search-history {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.saved-searches {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.saved-search-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px;
  background: var(--td-bg-color-container-hover);
  border-radius: var(--td-radius-small);
}

.saved-search-content {
  flex: 1;
}

.saved-search-name {
  font-size: 14px;
  font-weight: 500;
}

.saved-search-query {
  font-size: 12px;
  color: var(--td-text-color-secondary);
}

.saved-search-actions {
  display: flex;
  gap: 4px;
}

.search-actions {
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid var(--td-border-level-1-color);
}

.search-results-info {
  margin-top: 8px;
  font-size: 12px;
  color: var(--td-text-color-secondary);
}

.results-count {
  font-weight: 500;
}

.execution-time {
  margin-left: 8px;
}

:deep(mark) {
  background: var(--td-warning-color-1);
  color: var(--td-warning-color-8);
  padding: 0 2px;
  border-radius: 2px;
}

:deep(.t-checkbox-group) {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

:deep(.t-radio-group) {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
</style>