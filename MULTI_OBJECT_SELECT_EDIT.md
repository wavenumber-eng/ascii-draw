# Multi-Object Select Edit - Implementation Plan

This document describes the implementation plan for enhanced multi-select property editing.
Requirements are defined in `requirements.md` under "Multi-Select Property Editing" (MSE-* requirements).

## Overview

Enhance the Properties Panel to show meaningful information when multiple objects with different values are selected, and allow initialization from the first selected object when editing.

## Current Implementation

| Aspect | Current Behavior |
|--------|------------------|
| Mixed indicator | `...` placeholder for all types |
| Visual style | `.mixed` CSS class (green border, italic) |
| On focus | Field stays empty |
| On change | Applies to all selected objects |
| Undo | Per-object commands (already implemented) |

## Target Implementation

| Property Type | Mixed Indicator | On Focus Behavior |
|---------------|-----------------|-------------------|
| Number | `10...25` (range) | Populate with min value |
| Text | `...` | Populate with first value |
| Boolean | `[■]` indeterminate | Click applies state to all |
| Enum (select) | `single*` | Select applies to all |
| Enum (buttons) | Dashed border on first | Click applies to all |

---

## Implementation Steps

### Step 1: Enhance `getCommonPropertyValue()`

**Implements**: MSE-1, MSE-2, MSE-40, MSE-41, MSE-42

Extend the return object to include additional metadata for mixed states:

```javascript
getCommonPropertyValue(objects, prop) {
  if (objects.length === 0) return { value: null, mixed: false };

  const values = objects.map(obj => obj[prop]);
  const firstValue = values[0];
  const allSame = values.every(val => val === firstValue);

  if (allSame) {
    return { value: firstValue, mixed: false };
  }

  // Mixed state - compute additional info based on value type
  const numericValues = values.filter(v => typeof v === 'number');

  return {
    value: null,
    mixed: true,
    firstValue: firstValue,                              // MSE-40, MSE-41
    minValue: numericValues.length > 0 ? Math.min(...numericValues) : null,  // MSE-42
    maxValue: numericValues.length > 0 ? Math.max(...numericValues) : null   // MSE-42
  };
}
```

---

### Step 2: Update Number Input Placeholders

**Implements**: MSE-10

Change placeholder generation for number fields to show range:

```javascript
// In renderMultiSelectProperties()
const numberPlaceholder = (prop) => {
  if (!prop.mixed) return '';
  if (prop.minValue !== null && prop.maxValue !== null) {
    if (prop.minValue === prop.maxValue) {
      return `${prop.minValue}`;  // All same value (shouldn't happen if mixed)
    }
    return `${prop.minValue}...${prop.maxValue}`;  // MSE-10: Range format
  }
  return '...';
};

// Usage in HTML template:
<input type="number" class="property-input ${props.x.mixed ? 'mixed' : ''}"
       id="prop-x"
       value="${props.x.mixed ? '' : props.x.value}"
       placeholder="${numberPlaceholder(props.x)}"
       data-min-value="${props.x.minValue ?? ''}"
       data-first-value="${props.x.firstValue ?? ''}">
```

---

### Step 3: Update Enum Select Options

**Implements**: MSE-13

Change the mixed placeholder option to show first value with asterisk:

```javascript
// In renderMultiSelectProperties()
const enumPlaceholder = (prop) => {
  if (!prop.mixed) return '';
  return `${prop.firstValue}*`;  // MSE-13: First value + asterisk
};

// For style select:
<select class="property-select ${props.style.mixed ? 'mixed' : ''}" id="prop-style">
  ${props.style.mixed ? `<option value="" selected>${enumPlaceholder(props.style)}</option>` : ''}
  <option value="single" ${!props.style.mixed && props.style.value === 'single' ? 'selected' : ''}>Single</option>
  <option value="double" ${!props.style.mixed && props.style.value === 'double' ? 'selected' : ''}>Double</option>
  <option value="rounded" ${!props.style.mixed && props.style.value === 'rounded' ? 'selected' : ''}>Rounded</option>
</select>
```

---

### Step 4: Update Button Grid Styling

**Implements**: MSE-14

Add a new CSS class for mixed-first state on justify buttons:

```css
/* In style.css */
.justify-btn.mixed-first {
  background: transparent;
  border: 2px dashed var(--accent);
  color: var(--accent);
}

.justify-btn.mixed-first:hover {
  background: var(--bg-tertiary);
}
```

Update the button rendering:

```javascript
// In renderMultiSelectProperties()
const justifyBtnClass = (justify, prop) => {
  if (!prop.mixed && prop.value === justify) return 'active';
  if (prop.mixed && prop.firstValue === justify) return 'mixed-first';  // MSE-14
  return '';
};

// Usage:
<button class="justify-btn ${justifyBtnClass('top-left', props.textJustify)}"
        data-justify="top-left" title="Top Left">&#x2196;</button>
```

---

### Step 5: Add Focus Handlers for Initialization

**Implements**: MSE-20, MSE-21

Add focus event listeners that populate mixed fields:

```javascript
// In wireMultiSelectListeners()

// Number inputs - populate with min value on focus (MSE-20)
['x', 'y', 'width', 'height'].forEach(prop => {
  const input = document.getElementById(`prop-${prop}`);
  if (input && input.classList.contains('mixed')) {
    input.addEventListener('focus', () => {
      if (input.value === '') {
        const minValue = input.dataset.minValue;
        if (minValue !== '') {
          input.value = minValue;
          input.select();
        }
      }
    });
  }
});

// Text inputs - populate with first value on focus (MSE-21)
['title'].forEach(prop => {
  const input = document.getElementById(`prop-${prop}`);
  if (input && input.classList.contains('mixed')) {
    input.addEventListener('focus', () => {
      if (input.value === '') {
        const firstValue = input.dataset.firstValue;
        if (firstValue !== undefined && firstValue !== '') {
          input.value = firstValue;
          input.select();
        }
      }
    });
  }
});

// Textarea - populate with first value on focus (MSE-21)
const textArea = document.getElementById('prop-text');
if (textArea && textArea.classList.contains('mixed')) {
  textArea.addEventListener('focus', () => {
    if (textArea.value === '') {
      const firstValue = textArea.dataset.firstValue;
      if (firstValue !== undefined) {
        textArea.value = firstValue;
        textArea.select();
      }
    }
  });
}
```

---

### Step 6: Store First Values in Data Attributes

**Implements**: MSE-40, MSE-41

Update HTML templates to include data attributes for first values:

```javascript
// Number inputs
<input type="number" class="property-input ${props.x.mixed ? 'mixed' : ''}"
       id="prop-x"
       value="${props.x.mixed ? '' : props.x.value}"
       placeholder="${numberPlaceholder(props.x)}"
       data-min-value="${props.x.mixed ? props.x.minValue : ''}"
       data-first-value="${props.x.mixed ? props.x.firstValue : ''}">

// Text inputs
<input type="text" class="property-input ${props.title.mixed ? 'mixed' : ''}"
       id="prop-title"
       value="${props.title.mixed ? '' : (props.title.value || '')}"
       placeholder="${props.title.mixed ? '...' : 'Box title'}"
       data-first-value="${props.title.mixed ? (props.title.firstValue || '') : ''}">

// Textarea
<textarea class="property-textarea ${props.text.mixed ? 'mixed' : ''}"
          id="prop-text"
          placeholder="${props.text.mixed ? '...' : 'Text content'}"
          data-first-value="${props.text.mixed ? (props.text.firstValue || '') : ''}"
>${props.text.mixed ? '' : (props.text.value || '')}</textarea>
```

---

### Step 7: Boolean Checkbox Handling

**Implements**: MSE-12, MSE-22

The current implementation already uses `indeterminate` state. Verify behavior:

```javascript
// Already implemented - checkbox indeterminate state
const shadowCheck = document.getElementById('prop-shadow');
if (shadowCheck && props.shadow.mixed) {
  shadowCheck.indeterminate = true;  // MSE-12: Shows [■] indicator
}

// On change already applies to all (MSE-22)
shadowCheck.addEventListener('change', () => {
  this.updateMultipleObjectsProperty(objectIds, 'shadow', shadowCheck.checked);
});
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `ascii_editor.html` | `getCommonPropertyValue()`, `renderMultiSelectProperties()`, `wireMultiSelectListeners()` |
| `style.css` | Add `.justify-btn.mixed-first` class |

---

## Requirements Traceability Matrix

| Requirement | Implementation Location |
|-------------|------------------------|
| MSE-1 | `getCommonPropertyValue()` - returns `mixed: false` |
| MSE-2 | `getCommonPropertyValue()` - returns `mixed: true` with metadata |
| MSE-3 | HTML templates - `.mixed` class application |
| MSE-10 | `numberPlaceholder()` helper, HTML template |
| MSE-11 | HTML template - text inputs keep `...` placeholder |
| MSE-12 | `shadowCheck.indeterminate = true` (existing) |
| MSE-13 | `enumPlaceholder()` helper, select HTML template |
| MSE-14 | `justifyBtnClass()` helper, `.mixed-first` CSS class |
| MSE-20 | Focus handler for number inputs |
| MSE-21 | Focus handler for text inputs and textarea |
| MSE-22 | Change handler for checkbox (existing) |
| MSE-23 | Change handler for selects (existing) |
| MSE-24 | Click handler for justify buttons (existing) |
| MSE-30 | `updateMultipleObjectsProperty()` (existing) |
| MSE-31 | Loop creating `ModifyObjectCommand` per object (existing) |
| MSE-32 | `this.updatePropertiesPanel()` call after update (existing) |
| MSE-40 | `getCommonPropertyValue()` - `firstValue` from `objects[0]` |
| MSE-41 | `enumPlaceholder()` uses `firstValue` |
| MSE-42 | `getCommonPropertyValue()` - `minValue`, `maxValue` computed |
| MSE-50 | `renderMultiSelectProperties()` renders all listed properties |

---

## Testing Plan

### Test Case 1: Number Range Display
1. Create 3 boxes at X positions 10, 15, 25
2. Select all 3 boxes
3. **Verify**: X field shows placeholder `10...25`
4. **Verify**: Field has `.mixed` class (green border)

### Test Case 2: Number Focus Initialization
1. With 3 boxes selected (X: 10, 15, 25)
2. Click in the X field
3. **Verify**: Field populates with `10` (min value)
4. **Verify**: Text is selected
5. Type `20`, press Enter
6. **Verify**: All boxes now have X=20

### Test Case 3: Enum Select Display
1. Create 3 boxes with styles: single, double, single
2. Select all 3 boxes
3. **Verify**: Style dropdown shows `single*` as selected option
4. Select "Double" from dropdown
5. **Verify**: All boxes now have double style

### Test Case 4: Button Grid Display
1. Create 3 boxes with different text justifications
2. Select all 3 boxes
3. **Verify**: First box's justify button has dashed border
4. **Verify**: No button has solid "active" background
5. Click a different justify button
6. **Verify**: All boxes now have that justification

### Test Case 5: Boolean Indeterminate
1. Create 2 boxes: one with shadow, one without
2. Select both boxes
3. **Verify**: Shadow checkbox shows indeterminate state
4. Click checkbox
5. **Verify**: All boxes now have shadow (or all without, depending on click)

### Test Case 6: Text Focus Initialization
1. Create 2 boxes with different titles: "Box A", "Box B"
2. Select both boxes
3. Click in title field
4. **Verify**: Field populates with "Box A" (first selected)
5. **Verify**: Text is selected

---

## Implementation Order

1. **Step 1**: Enhance `getCommonPropertyValue()` - foundation for all other changes
2. **Step 2**: Number placeholders with range format
3. **Step 3**: Enum select placeholders with asterisk
4. **Step 4**: CSS for mixed-first button state
5. **Step 5**: Focus handlers for initialization
6. **Step 6**: Data attributes in HTML templates
7. **Step 7**: Verify boolean handling (mostly existing)

Estimated scope: ~100-150 lines of changes across 2 files.
