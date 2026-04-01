import { MessagePlugin } from 'tdesign-vue-next';
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useToolStore } from '@/stores/tool';
import type { JsonSchemaProperty, ToolInfo } from '@/types/tool';

export interface SchemaPropertyEntry {
  name: string;
  type: string;
  description: string;
  required: boolean;
  enumValues: string[];
  minimum: number | undefined;
  maximum: number | undefined;
  defaultValue: unknown;
}

export function useToolForm() {
  const route = useRoute();
  const router = useRouter();
  const toolStore = useToolStore();

  const toolName = computed(() => route.params.toolName as string);
  const loading = ref(false);
  const tool = ref<ToolInfo | null>(null);
  const formData = reactive<Record<string, unknown>>({});

  const schemaProperties = computed((): SchemaPropertyEntry[] => {
    if (!tool.value?.inputSchema?.properties) return [];
    const properties = tool.value.inputSchema.properties;
    const required = tool.value.inputSchema.required || [];

    return Object.entries(properties).map(([name, prop]) => {
      const p = prop as JsonSchemaProperty;
      return {
        name,
        type: p.type || 'string',
        description: p.description || '',
        required: required.includes(name),
        enumValues: p.enum || [],
        minimum: p.minimum,
        maximum: p.maximum,
        defaultValue: p.default,
      };
    });
  });

  const formLabel = (prop: SchemaPropertyEntry): string => {
    let label = prop.description || prop.name;
    if (prop.required) {
      label += ' *';
    }
    return label;
  };

  const formRulesForField = (prop: SchemaPropertyEntry) => {
    const rules: Record<string, unknown>[] = [];
    if (prop.required) {
      rules.push({ required: true, message: `${prop.name} 是必填参数` });
    }
    return rules;
  };

  const buildArguments = (): Record<string, unknown> => {
    const args: Record<string, unknown> = {};

    for (const prop of schemaProperties.value) {
      const value = formData[prop.name];

      if (value === undefined || value === null || value === '') {
        continue;
      }

      // Parse JSON fields for array/object types
      if (
        (prop.type === 'array' || prop.type === 'object') &&
        typeof value === 'string'
      ) {
        try {
          args[prop.name] = JSON.parse(value);
        } catch {
          args[prop.name] = value;
        }
      } else {
        args[prop.name] = value;
      }
    }

    return args;
  };

  const initFormDataDefaults = () => {
    // Clear existing
    for (const key of Object.keys(formData)) {
      formData[key] = undefined;
    }

    if (tool.value?.inputSchema?.properties) {
      for (const [name, prop] of Object.entries(
        tool.value.inputSchema.properties,
      )) {
        const p = prop as JsonSchemaProperty;
        if (p.default !== undefined) {
          formData[name] =
            typeof p.default === 'object'
              ? JSON.stringify(p.default, null, 2)
              : p.default;
        } else if (p.type === 'boolean') {
          formData[name] = false;
        } else {
          formData[name] = undefined;
        }
      }
    }
  };

  const fetchTool = async () => {
    loading.value = true;
    try {
      tool.value = await toolStore.fetchToolDetail(toolName.value);
      initFormDataDefaults();
    } catch {
      MessagePlugin.error('获取工具详情失败');
    } finally {
      loading.value = false;
    }
  };

  const goBackToDetail = () => {
    router.push({ name: 'ToolDetail', params: { toolName: toolName.value } });
  };

  onMounted(fetchTool);

  return {
    route,
    router,
    toolStore,
    toolName,
    loading,
    tool,
    formData,
    schemaProperties,
    formLabel,
    formRulesForField,
    buildArguments,
    initFormDataDefaults,
    goBackToDetail,
  };
}
