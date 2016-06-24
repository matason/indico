/* This file is part of Indico.
 * Copyright (C) 2002 - 2016 European Organization for Nuclear Research (CERN).
 *
 * Indico is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License as
 * published by the Free Software Foundation; either version 3 of the
 * License, or (at your option) any later version.
 *
 * Indico is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Indico; if not, see <http://www.gnu.org/licenses/>.
 */

(function(global) {
    'use strict';

    $(document).ready(function() {
        setupCategoryMoveButton();
    });

    function setupCategoryMoveButton() {
        $('.js-move-category').on('click', function(evt) {
            evt.preventDefault();
            $('<div>').categorynavigator({openInDialog: true});
        });
    }

    global.setupCategoryTable = function setupCategoryTable() {
        var $table = $('table.category-management');
        var $tbody = $table.find('tbody');
        var $bulkDeleteButton = $('.js-bulk-delete-category');
        var categoryRowSelector = 'tr[data-category-id]';
        var checkboxSelector = 'input[name=category_id]';

        $('.js-sort-categories').on('click', function() {
            var currentOrder = getSortedCategories();
            function undo() {
                restoreCategoryOrder(currentOrder);
                return setOrderAjax(currentOrder);
            }
            sortCategories();
            setOrderAjax(getSortedCategories());
            cornerMessage({
                actionLabel: $T.gettext("Undo"),
                actionCallback: undo,
                feedbackMessage: $T.gettext("The category order has been restored."),
                duration: 10000,
                message: $T.gettext("The category list has been sorted.")
            });
        });

        $table.find('.js-delete-category').on('indico:confirmed', function(evt) {
            evt.preventDefault();
            var $this = $(this);
            $.ajax({
                url: $this.data('href'),
                method: 'POST',
                error: handleAjaxError,
                success: function(data) {
                    $this.closest(categoryRowSelector).remove();
                    updateCategoryDeleteButton(data.is_parent_empty);
                }
            });
        });

        enableIfChecked($tbody, checkboxSelector, $bulkDeleteButton, function($checkboxes) {
            return $checkboxes.filter(':not([data-is-empty=true])').length == 0;
        });
        $bulkDeleteButton.on('click', bulkDeleteCategories).qtip({
            suppress: false,
            content: {
                text: bulkDeleteButtonTooltipContent
            }
        });

        $tbody.sortable({
            axis: 'y',
            containment: 'parent',
            cursor: 'move',
            handle: '.js-handle',
            items: '> tr',
            tolerance: 'pointer',
            update: function() {
                setOrderAjax(getSortedCategories());
            }
        });

        function getSortedCategories() {
            return $tbody.find(categoryRowSelector).map(function() {
                return $(this).data('category-id');
            }).toArray();
        }

        function restoreCategoryOrder(order) {
            $.each(order, function(index, id) {
                $tbody.find('[data-category-id=' + id + ']').detach().appendTo($tbody);
            });
        }

        function sortCategories() {
            $tbody.find(categoryRowSelector).sort(function(a, b) {
                return $(a).data('category-title').localeCompare($(b).data('category-title'));
            }).detach().appendTo($tbody);
        }

        function setOrderAjax(order) {
            return $.ajax({
                url: $table.data('sort-url'),
                method: 'POST',
                data: JSON.stringify({
                    categories: order
                }),
                dataType: 'json',
                contentType: 'application/json',
                error: handleAjaxError
            });
        }

        function updateCategoryDeleteButton(enabled) {
            if (enabled) {
                $('.banner .js-delete-category').removeClass('disabled')
                    .attr('title', $T.gettext("Delete category"));
            } else {
                $('.banner .js-delete-category').addClass('disabled')
                    .attr('title', $T.gettext("This category cannot be deleted because it is not empty."));
            }
        }

        function bulkDeleteButtonTooltipContent() {
            var $checked = getSelectedRows();
            if ($checked.length) {
                if ($bulkDeleteButton.hasClass('disabled')) {
                    return $T.gettext("At least one selected category cannot be deleted because it is not empty.");
                } else {
                    return $T.ngettext("Delete the selected category", "Delete {0} selected categories",
                                       $checked.length).format($checked.length);
                }
            } else {
                return $T.gettext("Select the categories to delete first.");
            }
        }

        function bulkDeleteCategories() {
            var $selectedRows = getSelectedRows();
            ajaxDialog({
                url: $table.data('bulk-delete-url'),
                method: 'POST',
                title: $T.gettext("Delete categories"),
                data: {
                    category_id: getSelectedCategories()
                },
                onClose: function(data) {
                    if (data && data.success) {
                        // Prevent other categories from being selected when someone reloads
                        // the page after deleting a selected category.
                        $selectedRows.find('input[type=checkbox]').prop('checked', false);
                        $selectedRows.remove();
                        updateCategoryDeleteButton(data.is_empty);
                    }
                }
            });
        }

        function getSelectedCategories() {
            return $table.find(categoryRowSelector).find(checkboxSelector + ':checked').map(function() {
                return this.value;
            }).toArray();
        }

        function getSelectedRows() {
            return $table.find(categoryRowSelector).has(checkboxSelector + ':checked');
        }
    };

    global.setupCategoryEventList = function setupCategoryEventsList() {
        enableIfChecked('#event-management', 'input[name=event_id]', '.js-enabled-if-checked');

        function createCategoryNavigator(element, data) {
            $('<div>').categorynavigator({
                openInDialog: true,
                selectLeafOnly: true,
                onAction: function(category) {
                    var txt = $T.gettext('You are about to move some of the events to category "{0}". Are you sure you want to proceed?').format(category.title)
                    confirmPrompt(txt, $T.gettext('Move events')).then(function() {
                        $.ajax({
                            url: element.data('href'),
                            type: 'POST',
                            data: JSON.stringify($.extend({'category_id': category.id}, data || {})),
                            dataType: 'json',
                            contentType: 'application/json',
                            error: handleAjaxError,
                            success: function(data) {
                                if (data.success) {
                                    location.reload();
                                }
                            }
                        });
                    });
                }
            });
        }

        $('.event-management .js-move-event-to-subcategory').on('click', function(evt) {
            evt.preventDefault();
            createCategoryNavigator($(this));
        });

        $('.event-management-toolbar .js-move-events-to-subcategory').on('click', function(evt) {
            evt.preventDefault();

            var $this = $(this);
            if ($this.hasClass('disabled')) {
                return;
            }

            var data = {};
            if ($this.data('params') && $this.data('params').all_selected) {
                data.all_selected = true;
            } else {
                data.event_id = _.map($('#event-management input[name=event_id]:checkbox:checked'), function(obj) {
                    return obj.value;
                });
            }

            createCategoryNavigator($this, data);
        });

        function deselectRows() {
            $('.js-enabled-if-checked').data('params', {all_selected: false});
        }

        $('#event-management input[name=event_id]').on('change', function() {
            var $this = $(this);
            var allSelectedInput = $('#event-management input[name=all-selected]');
            var total = $('#event-management').data('total');
            var selectionMessage = $('#selection-message');
            var notSelected = $('#event-management input[name=event_id]:not(:checked)').length;
            var selected = $('#event-management input[name=event_id]:checked').length;

            if (selected < total) {
                var message = $('<span>', {
                    text: $T.ngettext('Only one out of {1} events is currently selected. ',
                                      'Only {0} out of {1} events are currently selected. ', selected).format(selected, total)
                });

                if (notSelected === 0) {
                    $('<a>', {
                        'href': '#',
                        'text': $T.gettext('Click here to select them all.'),
                        'on': {
                            click: function(evt) {
                                evt.preventDefault();
                                $('.js-enabled-if-checked').data('params', {all_selected: 1});

                                var allSelectedMessage = $('<span>', {
                                    'text': $T.gettext('All {0} events contained within this category are currently selected. ').format(total)
                                });
                                $('<a>', {
                                    'href': '#',
                                    'text': $T.gettext('Select only current page.'),
                                    'on': {
                                        'click': function(evt) {
                                            evt.preventDefault();
                                            deselectRows();
                                            selectionMessage.hide();
                                        }
                                    }
                                }).appendTo(allSelectedMessage);
                                selectionMessage.html(allSelectedMessage);
                            }
                        }
                    }).appendTo(message);
                    selectionMessage.html(message).show();
                } else {
                    selectionMessage.hide();
                    deselectRows();
                }
            }
        });
    };
})(window);
