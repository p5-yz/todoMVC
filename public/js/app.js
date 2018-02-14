/*global jQuery, Handlebars, Router */
jQuery(function ($) {
    'use strict';
    Handlebars.registerHelper('eq', function (a, b, options) {
        return a === b ? options.fn(this) : options.inverse(this);
    });

    var ENTER_KEY = 13;
    var ESCAPE_KEY = 27;

    var util = {
        uuid: function () {
            /*jshint bitwise:false */
            var i, random;
            var uuid = '';

            for (i = 0; i < 32; i++) {
                random = Math.random() * 16 | 0;
                if (i === 8 || i === 12 || i === 16 || i === 20) {
                    uuid += '-';
                }
                uuid += (i === 12 ? 4 : (i === 16 ? (random & 3 | 8) : random)).toString(16);
            }
            return uuid;
        },
        pluralize: function (count, word) {
            return count === 1 ? word : word + 's';
        },
        store: function (namespace, data) {
            if (arguments.length > 1) {
                return localStorage.setItem(namespace, JSON.stringify(data));
            } else {
                var store = localStorage.getItem(namespace);
                return (store && JSON.parse(store)) || [];
            }
        }
    };

    // Note: This is not an official function of the todoMVC. This function places
    // the cursor at the end of the text in my todo lists.
    $.fn.setCursorPosition = function (pos) {
        this.each(function (index, elem) {
            // elem == this
            if (elem.setSelectionRange) {
                elem.setSelectionRange(pos, pos);
            } else if (elem.createTextRange) {
                var range = elem.createTextRange();
                range.collapse(true);
                range.moveEnd('character', pos);
                range.moveStart('character', pos);
                range.select();
            }
        });
        return this;
    };

    var App = {
        init: function () {
            this.todos = util.store('todos-jquery');
            this.todoTemplate = Handlebars.compile($('#todo-template').html());
            this.footerTemplate = Handlebars.compile($('#footer-template').html());
            this.bindEvents();
            this.router = new Router({
                '/:filter': function (filter) {
                    this.filter = filter;
                    view.render();
                }.bind(this)
            }).init('/all');
        },
        bindEvents: function () {
            var $new_todo = document.getElementById('new-todo');
            $new_todo.addEventListener('keyup', this.newTodoUpdate.bind(this));

            //$('#new-todo').on('keyup', this.newTodoUpdate.bind(this));
            $('#toggle-all').on('change', this.toggleAllUpdate.bind(this));
            $('#footer').on('click', '#clear-completed',
                this.destroyCompletedUpdate.bind(this));
            // Using event delegation. Method chaining.
            $('#todo-list')
                .on('change', '.toggle', this.toggleUpdate.bind(this))
                .on('dblclick', 'label', this.edit.bind(this))
                .on('keyup', '.edit', this.editKeyup.bind(this))
                .on('focusout', '.edit', this.amendTodoListUpdate.bind(this))
                .on('click', '.destroy', this.destroyUpdate.bind(this));
        },
        destroyUpdate: function (e) {
            this.destroy(e);
            this.saveTodos();
        },
        newTodoUpdate: function (e) {
            this.create(e);
            this.saveTodos();
        },
        toggleAllUpdate: function (e) {
            this.toggleAll(e);
            this.saveTodos();
        },
        destroyCompletedUpdate: function (e) {
            this.destroyCompleted();
            this.saveTodos();
        },
        toggleUpdate: function (e) {
            this.toggle(e);
            this.saveTodos();
        },
        amendTodoListUpdate: function (e) {
            this.update(e);
            this.saveTodos();
        },
        toggleAll: function (e) {
            var isChecked = $(e.target).prop('checked');
            this.todos.forEach(function (todo) {
                todo.completed = isChecked;
            });
            view.render();
        },
        getActiveTodos: function () {
            return this.todos.filter(function (todo) {
                return !todo.completed;
            });
        },
        getCompletedTodos: function () {
            return this.todos.filter(function (todo) {
                return todo.completed;
            });
        },
        getFilteredTodos: function () {
            if (this.filter === 'active') {
                return this.getActiveTodos();
            }

            if (this.filter === 'completed') {
                return this.getCompletedTodos();
            }
            return this.todos;
        },
        destroyCompleted: function () {
            this.todos = this.getActiveTodos();
            this.filter = 'all';
            view.render();
        },
        // accepts an element from inside the `.item` div and
        // returns the corresponding index in the `todos` array
        indexFromEl: function (el) {
            var id = $(el).closest('li').data('id')
            var todos = this.todos;
            var i = todos.length;

            while (i--) {
                if (todos[i].id === id) {
                    return i;
                }
            }
        },
        /*
        accepts the input string you entered; trims it; e.which returns the last character
        in this string to check whether a return was press, if so the string is pushed 
        onto the todos array of object
        */
        create: function (e) {
            var $input = $(e.target);
            var val = $input.val().trim();

            if (e.which !== ENTER_KEY || !val) {
                return;
            }

            this.todos.push({
                id: util.uuid(),
                title: val,
                completed: false
            });

            $input.val('');
            view.render();
        },
        toggle: function (e) {
            var i = this.indexFromEl(e.target);
            this.todos[i].completed = !this.todos[i].completed;
            view.render();
        },
        edit: function (e) {
            var $input = $(e.target).closest('li').addClass('editing').find('.edit');
            $input.val($input.val()).focus().setCursorPosition($input.val().length);
        },
        editKeyup: function (e) {
            if (e.which === ENTER_KEY) {
                // Hitting enter takes you out of edit mode.
                e.target.blur();
            }
            if (e.which === ESCAPE_KEY) {
                $(e.target).data('abort', true).blur();
            }
        },
        update: function (e) {
            var el = e.target;
            var $el = $(el);
            var val = $el.val().trim();

            if (!val) {
                this.destroy(e);
                return;
            }
            if ($el.data('abort')) {
                $el.data('abort', false);
            } else {
                this.todos[this.indexFromEl(el)].title = val;
            }
            view.render();
        },
        saveTodos: function () {
            util.store('todos-jquery', this.todos);
        },
        destroy: function (e) {
            // indexFromEl() converts the element clicked into an index
            this.todos.splice(this.indexFromEl(e.target), 1);
            console.log(this.todos);
            view.render();
        }
    };
    var view = {
        render: function () {
            var todos = App.getFilteredTodos();
            $('#todo-list').html(App.todoTemplate(todos));
            $('#main').toggle(todos.length > 0);
            $('#toggle-all').prop('checked', App.getActiveTodos().length === 0);
            this.renderFooter();
            $('#new-todo').focus();
        },
        renderFooter: function () {
            var todoCount = App.todos.length;
            var activeTodoCount = App.getActiveTodos().length;
            var template = App.footerTemplate({
                activeTodoCount: activeTodoCount,
                activeTodoWord: util.pluralize(activeTodoCount, 'item'),
                completedTodos: todoCount - activeTodoCount,
                filter: App.filter
            });
            $('#footer').toggle(todoCount > 0).html(template);
        }
    };
    App.init();
});


