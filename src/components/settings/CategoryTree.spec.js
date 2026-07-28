import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import CategoryTree from './CategoryTree.vue';
import { useCategoriesStore } from '../../stores/categories.js';
import { useTransactionsStore } from '../../stores/transactions.js';
import { useToastStore } from '../../stores/toast.js';
import * as categoriesDb from '../../db/categories.js';

vi.mock('../../db/categories.js');

function seed() {
  useCategoriesStore().items = [
    { id: 'food', name: 'Еда', emoji: '🍔', parentId: null, archived: false },
    { id: 'groceries', name: 'Продукты', emoji: '🛒', parentId: 'food', archived: false },
    { id: 'fun', name: 'Развлечения', emoji: '🎬', parentId: null, archived: false },
    { id: 'old', name: 'Старое', emoji: '📦', parentId: null, archived: true },
  ];
  useTransactionsStore().items = [{ id: 't1', amount: 500, date: '2026-07-01', categoryId: 'groceries' }];
}

beforeEach(() => {
  setActivePinia(createPinia());
  vi.clearAllMocks();
});

describe('CategoryTree', () => {
  it('renders active categories indented by depth, excluding archived ones', () => {
    seed();
    const wrapper = mount(CategoryTree);
    const rows = wrapper.findAll('.tree-row');
    expect(rows.map((r) => r.find('.tree-row__name').text())).toEqual(['Еда', 'Продукты', 'Развлечения']);
    expect(rows[1].attributes('style')).toContain('padding-left: 38px');
  });

  it('reveals archive/delete actions when the more button is tapped', async () => {
    seed();
    const wrapper = mount(CategoryTree);
    await wrapper.findAll('.tree-row__more')[0].trigger('click');
    expect(wrapper.findAll('.tree-row')[0].classes()).toContain('tree-row--revealed');
  });

  it('reflects the revealed state on its own more-button via aria-expanded', async () => {
    seed();
    const wrapper = mount(CategoryTree);
    const more = wrapper.findAll('.tree-row__more')[0];
    expect(more.attributes('aria-expanded')).toBe('false');
    await more.trigger('click');
    expect(more.attributes('aria-expanded')).toBe('true');
  });

  it('archives without prompting for confirmation', async () => {
    seed();
    categoriesDb.archiveCategory.mockResolvedValue(undefined);
    categoriesDb.listCategories.mockResolvedValue([]);
    const wrapper = mount(CategoryTree);
    await wrapper.findAll('.tree-row__more')[0].trigger('click');
    await wrapper.find('.tree-row__action--archive').trigger('click');
    expect(categoriesDb.archiveCategory).toHaveBeenCalledWith('food');
  });

  it('asks for confirmation before deleting, naming the affected transaction count', async () => {
    seed();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const wrapper = mount(CategoryTree);
    await wrapper.findAll('.tree-row__more')[0].trigger('click'); // Еда — its subtree has 1 transaction
    await wrapper.find('.tree-row__action--delete').trigger('click');
    expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining('1'));
    expect(categoriesDb.deleteCategory).not.toHaveBeenCalled();
  });

  it('deletes once the confirmation is accepted', async () => {
    seed();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    categoriesDb.deleteCategory.mockResolvedValue(undefined);
    categoriesDb.listCategories.mockResolvedValue([]);
    const wrapper = mount(CategoryTree);
    await wrapper.findAll('.tree-row__more')[0].trigger('click');
    await wrapper.find('.tree-row__action--delete').trigger('click');
    expect(categoriesDb.deleteCategory).toHaveBeenCalledWith('food');
  });
});

describe('CategoryTree — adding a category', () => {
  it('reveals a form when the add toggle is tapped', async () => {
    seed();
    const wrapper = mount(CategoryTree);
    await wrapper.find('.category-tree__add-toggle').trigger('click');
    expect(wrapper.find('.category-tree__add-form').exists()).toBe(true);
  });

  it('creates a root category with the entered name and emoji, then closes the form', async () => {
    seed();
    categoriesDb.createCategory.mockResolvedValue({ id: 'new1', name: 'Здоровье', emoji: '💊', parentId: null, archived: false });
    const wrapper = mount(CategoryTree);
    await wrapper.find('.category-tree__add-toggle').trigger('click');
    await wrapper.find('.category-tree__add-emoji').setValue('💊');
    await wrapper.find('.category-tree__add-name').setValue('Здоровье');
    await wrapper.find('.category-tree__add-form').trigger('submit');
    expect(categoriesDb.createCategory).toHaveBeenCalledWith({ name: 'Здоровье', emoji: '💊', parentId: null });
    // submitAdd -> categoriesStore.create -> categoriesDb.createCategory is two
    // awaits deep before addingOpen is reset — same shape as DebtsScreen's own
    // commit chain, where a single trigger()-implied nextTick() doesn't
    // reliably drain it.
    await flushPromises();
    expect(wrapper.find('.category-tree__add-form').exists()).toBe(false);
  });

  it('creates a subcategory when a parent is selected', async () => {
    seed();
    categoriesDb.createCategory.mockResolvedValue({ id: 'new2', name: 'Спортзал', emoji: '🏋️', parentId: 'food', archived: false });
    const wrapper = mount(CategoryTree);
    await wrapper.find('.category-tree__add-toggle').trigger('click');
    await wrapper.find('.category-tree__add-name').setValue('Спортзал');
    await wrapper.find('.category-tree__add-parent').setValue('food');
    await wrapper.find('.category-tree__add-form').trigger('submit');
    expect(categoriesDb.createCategory).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Спортзал', parentId: 'food' })
    );
  });

  it('does not submit without a name, showing a toast instead', async () => {
    seed();
    const wrapper = mount(CategoryTree);
    await wrapper.find('.category-tree__add-toggle').trigger('click');
    await wrapper.find('.category-tree__add-form').trigger('submit');
    expect(categoriesDb.createCategory).not.toHaveBeenCalled();
    expect(useToastStore().message).toBe('Введите название');
  });

  it('defaults to 📁 when no emoji is entered', async () => {
    seed();
    categoriesDb.createCategory.mockResolvedValue({ id: 'new3', name: 'Прочее', emoji: '📁', parentId: null, archived: false });
    const wrapper = mount(CategoryTree);
    await wrapper.find('.category-tree__add-toggle').trigger('click');
    await wrapper.find('.category-tree__add-name').setValue('Прочее');
    await wrapper.find('.category-tree__add-form').trigger('submit');
    expect(categoriesDb.createCategory).toHaveBeenCalledWith(
      expect.objectContaining({ emoji: '📁' })
    );
  });
});
