const API_BASE = 'https://jsonplaceholder.typicode.com';
const MAX_RETRIES = 3;
const BASE_RETRY_DELAY = 1000;
const USER_ID = 1;

let activeAbortController = null;

async function apiRequest(endpoint, options = {}) {
    const {
        method = 'GET',
        body = null,
        retries = MAX_RETRIES,
        ...fetchOptions
    } = options;

    if (activeAbortController) {
        activeAbortController.abort();
    }

    const abortController = new AbortController();
    activeAbortController = abortController;

    const url = `${API_BASE}${endpoint}`;
    const config = {
        method,
        headers: {
            'Content-Type': 'application/json',
            ...fetchOptions.headers
        },
        signal: abortController.signal,
        ...fetchOptions
    };

    if (body) {
        config.body = JSON.stringify(body);
    }

    let lastError;

    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const response = await fetch(url, config);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const contentType = response.headers.get('content-type');
            const data = (contentType && contentType.includes('application/json'))
                ? await response.json()
                : null;

            if (activeAbortController === abortController) {
                activeAbortController = null;
            }

            return data;

        } catch (error) {
            lastError = error;

            if (error.name === 'AbortError') {
                throw error;
            }

            if (error.message && error.message.startsWith('HTTP 4')) {
                throw error;
            }

            if (attempt < retries) {
                const delay = BASE_RETRY_DELAY * Math.pow(2, attempt);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    if (activeAbortController === abortController) {
        activeAbortController = null;
    }

    throw lastError;
}

async function getTodos() {
    return apiRequest(`/todos?userId=${USER_ID}&_limit=5`, {
        preventRace: true
    });
}

async function addTodo(title) {
    return apiRequest('/todos', {
        method: 'POST',
        body: {
            title,
            completed: false,
            userId: USER_ID
        },
        preventRace: false
    });
}

async function deleteTodo(id) {
    return apiRequest(`/todos/${id}`, {
        method: 'DELETE',
        preventRace: false
    });
}

async function updateTodo(id, updates) {
    return apiRequest(`/todos/${id}`, {
        method: 'PATCH',
        body: updates,
        preventRace: false
    });
}

document.addEventListener('DOMContentLoaded', function () {
    const taskForm = document.querySelector('form');
    const taskInput = document.getElementById('task-input');
    const taskList = document.querySelector('ul');
    const completedSection = document.querySelector('section[aria-labelledby="completed-heading"]');

    let isLoading = false;

    function setLoading(loading) {
        isLoading = loading;
        taskInput.disabled = loading;
        const buttons = document.querySelectorAll('button');
        buttons.forEach(btn => btn.disabled = loading);
    }

    function showError(message) {
        console.error(message);
        alert('Something went wrong: ' + message);
    }

    function renderTask(todo) {
        const li = document.createElement('li');
        li.setAttribute('data-task-id', todo.id);

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = 'task-' + todo.id;
        checkbox.checked = todo.completed;

        const label = document.createElement('label');
        label.setAttribute('for', 'task-' + todo.id);
        label.textContent = todo.title;

        if (todo.completed) {
            label.style.textDecoration = 'line-through';
            label.style.opacity = '0.6';
        }

        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.setAttribute('aria-label', 'Delete task: ' + todo.title);
        deleteBtn.textContent = 'Delete';

        deleteBtn.addEventListener('click', async function () {
            if (isLoading) return;
            if (!confirm('Are you sure you want to delete this task?')) return;

            setLoading(true);
            try {
                await deleteTodo(todo.id);
                li.remove();
                if (todo.completed) checkEmptyCompleted();
            } catch (error) {
                if (error.name !== 'AbortError') {
                    showError('Failed to delete task. Please try again.');
                }
            } finally {
                setLoading(false);
            }
        });

        checkbox.addEventListener('change', async function () {
            if (isLoading) {
                checkbox.checked = !checkbox.checked;
                return;
            }

            setLoading(true);
            try {
                const updated = await updateTodo(todo.id, {
                    completed: checkbox.checked
                });

                if (updated.completed) {
                    label.style.textDecoration = 'line-through';
                    label.style.opacity = '0.6';
                    moveToCompleted(li);
                } else {
                    label.style.textDecoration = 'none';
                    label.style.opacity = '1';
                    moveToActive(li);
                }
            } catch (error) {
                if (error.name !== 'AbortError') {
                    checkbox.checked = !checkbox.checked;
                    showError('Failed to update task. Please try again.');
                }
            } finally {
                setLoading(false);
            }
        });

        li.appendChild(checkbox);
        li.appendChild(label);
        li.appendChild(deleteBtn);

        return li;
    }

    function moveToCompleted(taskElement) {
        let completedList = document.getElementById('completed-task-list');

        if (!completedList) {
            completedList = document.createElement('ul');
            completedList.id = 'completed-task-list';
            completedSection.appendChild(completedList);

            const emptyMsg = completedSection.querySelector('p');
            if (emptyMsg) emptyMsg.remove();
        }

        completedList.appendChild(taskElement);
    }

    function moveToActive(taskElement) {
        taskList.appendChild(taskElement);
        checkEmptyCompleted();
    }

    function checkEmptyCompleted() {
        const completedList = document.getElementById('completed-task-list');
        if (completedList && completedList.children.length === 0) {
            const emptyMsg = document.createElement('p');
            emptyMsg.textContent = 'No completed tasks yet.';
            completedSection.appendChild(emptyMsg);
            completedList.remove();
        }
    }

    async function loadTasks() {
        if (isLoading) return;

        setLoading(true);
        try {
            const todos = await getTodos();

            todos.forEach(todo => {
                const el = renderTask(todo);
                if (todo.completed) {
                    moveToCompleted(el);
                } else {
                    taskList.appendChild(el);
                }
            });

        } catch (error) {
            if (error.name !== 'AbortError') {
                showError('Failed to load tasks. Please check your connection and try again.');
            }
        } finally {
            setLoading(false);
        }
    }

    async function handleAddTask(event) {
        event.preventDefault();

        const title = taskInput.value.trim();
        if (!title || isLoading) return;

        setLoading(true);
        try {
            const newTodo = await addTodo(title);
            const el = renderTask(newTodo);
            taskList.appendChild(el);

            taskInput.value = '';
            taskInput.focus();
        } catch (error) {
            if (error.name !== 'AbortError') {
                showError('Failed to add task. Please try again.');
            }
        } finally {
            setLoading(false);
        }
    }

    taskForm.addEventListener('submit', handleAddTask);
    loadTasks();
});