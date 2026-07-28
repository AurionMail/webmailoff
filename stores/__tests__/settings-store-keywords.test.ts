import { describe, it, expect, beforeEach } from 'vitest';
import { useSettingsStore, DEFAULT_KEYWORDS, KEYWORD_PALETTE } from '../settings-store';
import type { KeywordDefinition } from '../settings-store';

describe('settings-store keywords', () => {
  beforeEach(() => {
    useSettingsStore.setState({ emailKeywords: [...DEFAULT_KEYWORDS] });
  });

  describe('DEFAULT_KEYWORDS', () => {
    it('has 7 default keywords', () => {
      expect(DEFAULT_KEYWORDS).toHaveLength(7);
    });

    it('each default keyword has a valid palette color', () => {
      DEFAULT_KEYWORDS.forEach((kw) => {
        expect(KEYWORD_PALETTE[kw.color]).toBeDefined();
        expect(KEYWORD_PALETTE[kw.color].dot).toBeTruthy();
        expect(KEYWORD_PALETTE[kw.color].bg).toBeTruthy();
      });
    });

    it('all default keyword ids are unique', () => {
      const ids = DEFAULT_KEYWORDS.map((k) => k.id);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  describe('KEYWORD_PALETTE', () => {
    it('has 13 colors', () => {
      expect(Object.keys(KEYWORD_PALETTE)).toHaveLength(13);
    });

    it('each color has dot and bg classes', () => {
      Object.values(KEYWORD_PALETTE).forEach((entry) => {
        expect(entry.dot).toMatch(/^bg-/);
        expect(entry.bg).toMatch(/^bg-/);
      });
    });
  });

  describe('addKeyword', () => {
    it('adds a new keyword to the list', () => {
      const newKw: KeywordDefinition = { id: 'custom', label: 'Custom', color: 'teal' };
      useSettingsStore.getState().addKeyword(newKw);
      const keywords = useSettingsStore.getState().emailKeywords;
      expect(keywords).toHaveLength(DEFAULT_KEYWORDS.length + 1);
      expect(keywords[keywords.length - 1]).toEqual(newKw);
    });

    it('does not add duplicate keyword id', () => {
      const duplicate: KeywordDefinition = { id: 'red', label: 'Another Red', color: 'red' };
      useSettingsStore.getState().addKeyword(duplicate);
      expect(useSettingsStore.getState().emailKeywords).toHaveLength(DEFAULT_KEYWORDS.length);
    });

    it('allows adding keyword after removing one with same id', () => {
      useSettingsStore.getState().removeKeyword('red');
      const newRed: KeywordDefinition = { id: 'red', label: 'New Red', color: 'red' };
      useSettingsStore.getState().addKeyword(newRed);
      const kw = useSettingsStore.getState().emailKeywords.find((k) => k.id === 'red');
      expect(kw?.label).toBe('New Red');
    });
  });

  describe('updateKeyword', () => {
    it('updates label of existing keyword', () => {
      useSettingsStore.getState().updateKeyword('red', { label: 'Crimson' });
      const kw = useSettingsStore.getState().emailKeywords.find((k) => k.id === 'red');
      expect(kw?.label).toBe('Crimson');
      expect(kw?.color).toBe('red'); // color unchanged
    });

    it('updates color of existing keyword', () => {
      useSettingsStore.getState().updateKeyword('blue', { color: 'cyan' });
      const kw = useSettingsStore.getState().emailKeywords.find((k) => k.id === 'blue');
      expect(kw?.color).toBe('cyan');
      expect(kw?.label).toBe('Blue'); // label unchanged
    });

    it('updates both label and color', () => {
      useSettingsStore.getState().updateKeyword('green', { label: 'Emerald', color: 'teal' });
      const kw = useSettingsStore.getState().emailKeywords.find((k) => k.id === 'green');
      expect(kw?.label).toBe('Emerald');
      expect(kw?.color).toBe('teal');
    });

    it('does not affect other keywords', () => {
      useSettingsStore.getState().updateKeyword('red', { label: 'Crimson' });
      const blue = useSettingsStore.getState().emailKeywords.find((k) => k.id === 'blue');
      expect(blue?.label).toBe('Blue');
    });

    it('is a no-op for non-existent id', () => {
      const before = useSettingsStore.getState().emailKeywords;
      useSettingsStore.getState().updateKeyword('nonexistent', { label: 'Test' });
      const after = useSettingsStore.getState().emailKeywords;
      expect(after).toHaveLength(before.length);
    });
  });

  describe('removeKeyword', () => {
    it('removes a keyword by id', () => {
      useSettingsStore.getState().removeKeyword('red');
      const keywords = useSettingsStore.getState().emailKeywords;
      expect(keywords).toHaveLength(DEFAULT_KEYWORDS.length - 1);
      expect(keywords.find((k) => k.id === 'red')).toBeUndefined();
    });

    it('is a no-op for non-existent id', () => {
      useSettingsStore.getState().removeKeyword('nonexistent');
      expect(useSettingsStore.getState().emailKeywords).toHaveLength(DEFAULT_KEYWORDS.length);
    });

    it('preserves order of remaining keywords', () => {
      useSettingsStore.getState().removeKeyword('green');
      const ids = useSettingsStore.getState().emailKeywords.map((k) => k.id);
      expect(ids).toEqual(['red', 'orange', 'yellow', 'blue', 'purple', 'pink']);
    });
  });

  describe('reorderKeywords', () => {
    it('replaces keyword list with new ordering', () => {
      const reversed = [...DEFAULT_KEYWORDS].reverse();
      useSettingsStore.getState().reorderKeywords(reversed);
      const ids = useSettingsStore.getState().emailKeywords.map((k) => k.id);
      expect(ids).toEqual(reversed.map((k) => k.id));
    });

    it('can set to empty list', () => {
      useSettingsStore.getState().reorderKeywords([]);
      expect(useSettingsStore.getState().emailKeywords).toHaveLength(0);
    });

    it('can reset to defaults', () => {
      useSettingsStore.getState().removeKeyword('red');
      useSettingsStore.getState().removeKeyword('blue');
      useSettingsStore.getState().reorderKeywords(DEFAULT_KEYWORDS);
      expect(useSettingsStore.getState().emailKeywords).toEqual(DEFAULT_KEYWORDS);
    });
  });

  describe('getKeywordById', () => {
    it('finds keyword by id', () => {
      const kw = useSettingsStore.getState().getKeywordById('blue');
      expect(kw).toEqual({ id: 'blue', label: 'Blue', color: 'blue' });
    });

    it('returns undefined for non-existent id', () => {
      expect(useSettingsStore.getState().getKeywordById('nonexistent')).toBeUndefined();
    });

    it('returns updated keyword data after updateKeyword', () => {
      useSettingsStore.getState().updateKeyword('red', { label: 'Scarlet' });
      const kw = useSettingsStore.getState().getKeywordById('red');
      expect(kw?.label).toBe('Scarlet');
    });
  });

  describe('nestedTags', () => {
    it('is off by default', () => {
      useSettingsStore.getState().resetToDefaults();
      expect(useSettingsStore.getState().nestedTags).toBe(false);
    });

    it('is included in exported settings', () => {
      useSettingsStore.getState().updateSetting('nestedTags', true);
      const exported = JSON.parse(useSettingsStore.getState().exportSettings()) as {
        nestedTags?: boolean;
      };
      expect(exported.nestedTags).toBe(true);
    });
  });
});
