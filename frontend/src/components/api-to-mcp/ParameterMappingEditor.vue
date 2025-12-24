<template>
  <div class="parameter-mapping-editor">
    <div class="editor-header">
      <h3>参数映射编辑器</h3>
      <t-space>
        <t-button
          variant="outline"
          size="small"
          @click="autoMap"
        >
          <template #icon><StarIcon /></template>
          自动映射
        </t-button>
        <t-button
          variant="outline"
          size="small"
          @click="clearMappings"
        >
          <template #icon><CloseIcon /></template>
          清空映射
        </t-button>
        <t-button
          theme="primary"
          size="small"
          @click="addMapping"
        >
          <template #icon><AddIcon /></template>
          添加映射
        </t-button>
      </t-space>
    </div>

    <div class="mapping-container">
      <!-- 源参数列表 -->
      <div class="source-params">
        <div class="section-header">
          <span>源参数</span>
          <t-badge :count="sourceParams.length" theme="primary" />
        </div>
        <div class="params-list">
          <div
            v-for="param in sourceParams"
            :key="param.name"
            class="param-item"
            :class="{ 'selected': selectedSourceParam === param.name }"
            @click="selectSourceParam(param)"
            @dragstart="handleDragStart($event, 'source', param)"
            draggable="true"
          >
            <div class="param-icon">
              <component :is="getParamTypeIconComponent(param.type)" />
            </div>
            <div class="param-info">
              <div class="param-name">{{ param.name }}</div>
              <div class="param-type">{{ param.type }}</div>
            </div>
            <div v-if="param.required" class="param-required">
              <t-badge count="必填" theme="error" />
            </div>
          </div>
        </div>
      </div>

      <!-- 映射区域 -->
      <div class="mapping-area">
        <div class="mapping-header">
          <span>参数映射</span>
          <t-badge :count="mappings.length" theme="primary" />
        </div>
        <div class="mapping-list">
          <div
            v-for="(mapping, index) in mappings"
            :key="mapping.id"
            class="mapping-item"
          >
            <div class="mapping-controls">
              <t-button
                variant="text"
                size="small"
                theme="danger"
                @click="removeMapping(index)"
              >
                <template #icon><DeleteIcon /></template>
              </t-button>
            </div>
            
            <div class="mapping-content">
              <div class="mapping-source">
                <div class="param-display">
                  <span class="param-name">{{ mapping.source }}</span>
                  <span class="param-type">{{ getParamType(mapping.source) }}</span>
                </div>
              </div>

              <div class="mapping-arrow">
                <ChevronRightIcon />
              </div>

              <div class="mapping-target">
                <t-input
                  v-model="mapping.target"
                  placeholder="目标参数名"
                  size="small"
                  class="target-input"
                />
              </div>

              <div class="mapping-type">
                <t-select
                  v-model="mapping.type"
                  size="small"
                  @change="handleMappingTypeChange(index)"
                >
                  <t-option value="direct">直接映射</t-option>
                  <t-option value="transform">转换映射</t-option>
                  <t-option value="static">静态值</t-option>
                </t-select>
              </div>
            </div>

            <div v-if="mapping.type === 'transform'" class="mapping-transform">
              <t-input
                v-model="mapping.transform"
                placeholder="转换函数：value => transform(value)"
                size="small"
                class="transform-input"
              />
            </div>

            <div v-if="mapping.type === 'static'" class="mapping-static">
              <t-input
                v-model="mapping.staticValue"
                placeholder="静态值"
                size="small"
                class="static-input"
              />
            </div>

            <div class="mapping-validation">
              <t-switch
                v-model="mapping.required"
                size="small"
                label="必填"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- 目标参数预览 -->
      <div class="target-preview">
        <div class="section-header">
          <span>目标参数预览</span>
          <t-button
            variant="outline"
            size="small"
            @click="previewMapping"
          >
            <template #icon><InfoCircleIcon /></template>
            预览
          </t-button>
        </div>
        <div class="preview-content">
          <div class="preview-item">
            <t-textarea
              :value="previewJson"
              readonly
              :rows="8"
              class="preview-json"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- 测试区域 -->
    <div class="test-section">
      <t-divider>映射测试</t-divider>
      <div class="test-content">
        <t-form layout="inline">
          <t-form-item label="测试数据">
            <t-input
              v-model="testData"
              placeholder="输入测试数据（JSON格式）"
              class="test-input"
            />
          </t-form-item>
          <t-form-item>
            <t-button
              theme="primary"
              @click="testMapping"
            >
              <template #icon><PlayIcon /></template>
              测试映射
            </t-button>
          </t-form-item>
        </t-form>
        
        <div v-if="testResult" class="test-result">
          <div class="result-header">测试结果</div>
          <div class="result-content">
            <t-textarea
              :value="testResult"
              readonly
              :rows="6"
              class="result-json"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- 拖拽提示 -->
    <div v-if="showDragHint" class="drag-hint">
      <t-alert
        theme="info"
        message="拖拽参数到映射区域创建映射"
        closable
        @close="showDragHint = false"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, nextTick, markRaw, type Component } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import {
  AddIcon,
  ChevronRightIcon,
  CloseIcon,
  DeleteIcon,
  InfoCircleIcon,
  PlayIcon,
  StarIcon,
} from 'tdesign-icons-vue-next';
import type { ParameterMapping } from '@/types/api-to-mcp';

// 参数类型图标组件映射
const paramTypeIconMap: Record<string, Component> = {
  string: markRaw(StarIcon),
  number: markRaw(PlayIcon),
  boolean: markRaw(CloseIcon),
  array: markRaw(AddIcon),
  object: markRaw(InfoCircleIcon),
};

// 获取参数类型图标组件
const getParamTypeIconComponent = (type: string): Component => {
  return paramTypeIconMap[type] || paramTypeIconMap.string;
};

interface Props {
  sourceSchema: any;
  targetSchema?: any;
}

interface Emits {
  (e: 'update:mappings', mappings: ParameterMapping[]): void;
}

const props = withDefaults(defineProps<Props>(), {
  sourceSchema: () => ({}),
  targetSchema: undefined,
});

const emit = defineEmits<Emits>();

const mappings = ref<ParameterMapping[]>([]);
const selectedSourceParam = ref('');
const showDragHint = ref(true);
const testData = ref('');
const testResult = ref('');
const previewJson = ref('');

// 源参数列表
const sourceParams = computed(() => {
  const params: Array<{ name: string; type: string; required: boolean }> = [];
  
  if (props.sourceSchema && props.sourceSchema.properties) {
    Object.entries(props.sourceSchema.properties).forEach(([name, schema]: [string, any]) => {
      params.push({
        name,
        type: schema.type || 'string',
        required: props.sourceSchema.required?.includes(name) || false,
      });
    });
  }
  
  return params;
});

// 获取参数类型图标
const getParamTypeIcon = (type: string) => {
  switch (type) {
    case 'string':
      return 'text';
    case 'number':
      return 'number';
    case 'boolean':
      return 'check-circle';
    case 'object':
      return 'layers';
    case 'array':
      return 'list';
    default:
      return 'variable';
  }
};

// 获取参数类型
const getParamType = (paramName: string) => {
  const param = sourceParams.value.find(p => p.name === paramName);
  return param?.type || 'unknown';
};

// 选择源参数
const selectSourceParam = (param: any) => {
  selectedSourceParam.value = param.name;
};

// 拖拽开始
const handleDragStart = (event: DragEvent, type: 'source' | 'target', param: any) => {
  event.dataTransfer?.setData('text/plain', JSON.stringify({ type, param }));
};

// 自动映射
const autoMap = () => {
  const newMappings: ParameterMapping[] = [];
  
  sourceParams.value.forEach(param => {
    newMappings.push({
      source: param.name,
      target: param.name,
      type: 'direct',
      required: param.required,
    });
  });
  
  mappings.value = newMappings;
  updatePreview();
  MessagePlugin.success('自动映射完成');
};

// 清空映射
const clearMappings = () => {
  mappings.value = [];
  updatePreview();
  MessagePlugin.info('映射已清空');
};

// 添加映射
const addMapping = () => {
  if (selectedSourceParam.value) {
    mappings.value.push({
      source: selectedSourceParam.value,
      target: selectedSourceParam.value,
      type: 'direct',
      required: false,
    });
    updatePreview();
  } else {
    MessagePlugin.warning('请先选择一个源参数');
  }
};

// 移除映射
const removeMapping = (index: number) => {
  mappings.value.splice(index, 1);
  updatePreview();
};

// 映射类型变更
const handleMappingTypeChange = (index: number) => {
  const mapping = mappings.value[index];
  if (mapping.type === 'transform') {
    mapping.staticValue = undefined;
  } else if (mapping.type === 'static') {
    mapping.transform = undefined;
  } else {
    mapping.transform = undefined;
    mapping.staticValue = undefined;
  }
  updatePreview();
};

// 更新预览
const updatePreview = () => {
  const preview: Record<string, any> = {};
  
  mappings.value.forEach(mapping => {
    if (mapping.type === 'direct') {
      preview[mapping.target] = `{{${mapping.source}}}`;
    } else if (mapping.type === 'transform') {
      preview[mapping.target] = `transform(${mapping.source})`;
    } else if (mapping.type === 'static') {
      preview[mapping.target] = mapping.staticValue;
    }
  });
  
  previewJson.value = JSON.stringify(preview, null, 2);
  emit('update:mappings', mappings.value);
};

// 预览映射
const previewMapping = () => {
  updatePreview();
  MessagePlugin.success('预览已更新');
};

// 测试映射
const testMapping = () => {
  try {
    if (!testData.value.trim()) {
      MessagePlugin.warning('请输入测试数据');
      return;
    }

    const testInput = JSON.parse(testData.value);
    const result: Record<string, any> = {};
    
    mappings.value.forEach(mapping => {
      if (mapping.type === 'direct') {
        result[mapping.target] = testInput[mapping.source];
      } else if (mapping.type === 'transform') {
        // 简单的转换函数执行（实际应该更安全）
        try {
          const transformFn = new Function('value', `return ${mapping.transform}`);
          result[mapping.target] = transformFn(testInput[mapping.source]);
        } catch (error) {
          result[mapping.target] = `转换错误: ${(error as Error).message}`;
        }
      } else if (mapping.type === 'static') {
        result[mapping.target] = mapping.staticValue;
      }
    });
    
    testResult.value = JSON.stringify(result, null, 2);
    MessagePlugin.success('映射测试完成');
  } catch (error) {
    testResult.value = `测试错误: ${(error as Error).message}`;
    MessagePlugin.error('测试数据格式错误');
  }
};

// 组件挂载时显示提示
onMounted(() => {
  setTimeout(() => {
    showDragHint.value = false;
  }, 5000);
});
</script>

<style scoped>
.parameter-mapping-editor {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.editor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  background: var(--td-bg-color-container);
  border-radius: 6px;
  border: 1px solid var(--td-border-level-1-color);
}

.editor-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--td-text-color-primary);
}

.mapping-container {
  display: grid;
  grid-template-columns: 1fr 2fr 1fr;
  gap: 16px;
  min-height: 400px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 600;
  color: var(--td-text-color-primary);
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--td-border-level-1-color);
}

.source-params {
  background: var(--td-bg-color-container);
  border-radius: 6px;
  border: 1px solid var(--td-border-level-1-color);
  padding: 12px;
}

.params-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 350px;
  overflow-y: auto;
}

.param-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 4px;
  border: 1px solid var(--td-border-level-1-color);
  cursor: pointer;
  transition: all 0.2s;
}

.param-item:hover {
  background: var(--td-bg-color-container-hover);
  border-color: var(--td-brand-color);
}

.param-item.selected {
  background: var(--td-brand-color-1);
  border-color: var(--td-brand-color);
}

.param-icon {
  color: var(--td-text-color-secondary);
}

.param-info {
  flex: 1;
}

.param-name {
  font-weight: 500;
  color: var(--td-text-color-primary);
}

.param-type {
  font-size: 12px;
  color: var(--td-text-color-secondary);
}

.param-required {
  font-size: 12px;
}

.mapping-area {
  background: var(--td-bg-color-container);
  border-radius: 6px;
  border: 1px solid var(--td-border-level-1-color);
  padding: 12px;
}

.mapping-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 350px;
  overflow-y: auto;
}

.mapping-item {
  position: relative;
  background: var(--td-bg-color-container-select);
  border-radius: 4px;
  border: 1px solid var(--td-border-level-1-color);
  padding: 12px;
}

.mapping-controls {
  position: absolute;
  top: 8px;
  right: 8px;
}

.mapping-content {
  display: grid;
  grid-template-columns: 1fr auto 1fr auto;
  gap: 12px;
  align-items: center;
}

.param-display {
  display: flex;
  align-items: center;
  gap: 8px;
}

.mapping-arrow {
  color: var(--td-text-color-secondary);
}

.target-input {
  min-width: 150px;
}

.mapping-type {
  min-width: 120px;
}

.mapping-transform,
.mapping-static {
  margin-top: 8px;
}

.transform-input,
.static-input {
  width: 100%;
}

.mapping-validation {
  margin-top: 8px;
}

.target-preview {
  background: var(--td-bg-color-container);
  border-radius: 6px;
  border: 1px solid var(--td-border-level-1-color);
  padding: 12px;
}

.preview-content {
  border: 1px solid var(--td-border-level-1-color);
  border-radius: 4px;
  overflow: hidden;
}

.preview-json {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 14px;
  line-height: 1.5;
  border: none;
  resize: none;
}

.test-section {
  background: var(--td-bg-color-container);
  border-radius: 6px;
  border: 1px solid var(--td-border-level-1-color);
  padding: 16px;
}

.test-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.test-input {
  min-width: 300px;
}

.test-result {
  margin-top: 12px;
}

.result-header {
  font-weight: 600;
  color: var(--td-text-color-primary);
  margin-bottom: 8px;
}

.result-content {
  border: 1px solid var(--td-border-level-1-color);
  border-radius: 4px;
  overflow: hidden;
}

.result-json {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 14px;
  line-height: 1.5;
  border: none;
  resize: none;
}

.drag-hint {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 1000;
  max-width: 300px;
}
</style>