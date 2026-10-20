import { useEffect, useRef, useState } from 'react';
import { Field, Input, Text } from '@fluentui/react-components';
import { clamp, round } from '@sealpad/core';

interface Props {
  label: string;
  value: number;
  onCommit(value: number): void;
  min: number;
  max: number;
  step?: number;
  digits?: number;
  unit?: string;
  hint?: string;
  disabled?: boolean;
  testId?: string;
}

/** 数字输入：输入合法数字时实时生效，失去焦点时再规范化显示 */
export function NumberField(props: Props) {
  const digits = props.digits ?? 1;
  const format = (v: number) => String(round(v, digits));
  const [text, setText] = useState(format(props.value));
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setText(format(props.value));
  }, [props.value, digits]);

  const commit = () => {
    const v = Number.parseFloat(text);
    if (Number.isFinite(v)) {
      const c = clamp(v, props.min, props.max);
      props.onCommit(c);
      setText(format(c));
    } else {
      setText(format(props.value));
    }
  };

  return (
    <Field label={props.label} hint={props.hint} size="small">
      <Input
        size="small"
        type="number"
        inputMode="decimal"
        value={text}
        min={props.min}
        max={props.max}
        step={props.step ?? 1}
        disabled={props.disabled}
        data-testid={props.testId}
        contentAfter={props.unit ? <Text size={200}>{props.unit}</Text> : undefined}
        onFocus={() => (focused.current = true)}
        onBlur={() => {
          focused.current = false;
          commit();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
        }}
        onChange={(_, d) => {
          setText(d.value);
          const v = Number.parseFloat(d.value);
          if (Number.isFinite(v) && v >= props.min && v <= props.max) props.onCommit(v);
        }}
      />
    </Field>
  );
}
