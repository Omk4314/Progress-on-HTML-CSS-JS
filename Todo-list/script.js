
document.addEventListener('DOMContentLoaded', function () {
    // --- Grab references to DOM elements ---
    const taskForm = document.querySelector('form');
    const taskInput = document.getElementById('task-input');
    const taskList = document.querySelector('ul');
    const completedSection = document.querySelector('section[aria-labelledby="completed-heading"]');
    const completedHeading = document.getElementById('completed-heading');


    let taskCounter = 3; 


    function createTaskElement(taskText) {
        taskCounter++;

        // Create <li>
        const li = document.createElement('li');
        li.setAttribute('data-task-id', taskCounter);

        // Create checkbox
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = 'task-' + taskCounter;
        checkbox.name = 'task-' + taskCounter;

        // Create label
        const label = document.createElement('label');
        label.setAttribute('for', 'task-' + taskCounter);
        label.textContent = taskText;

        // Create delete button
        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.setAttribute('aria-label', 'Delete task: ' + taskText);
        deleteBtn.textContent = 'Delete';

        // Assemble the task
        li.appendChild(checkbox);
        li.appendChild(label);
        li.appendChild(deleteBtn);

        // --- Event: Delete button clicked ---
        deleteBtn.addEventListener('click', function () {
            deleteTask(li);
        });

        // --- Event: Checkbox toggled ---
        checkbox.addEventListener('change', function () {
            handleTaskToggle(checkbox, label, li);
        });

        return li;
    }


    function addTask(event) {
        event.preventDefault(); // Stop form from submitting/reloading

        const taskText = taskInput.value.trim();

        // Don't add empty tasks
        if (taskText === '') {
            return;
        }

        // Create and append the new task
        const newTask = createTaskElement(taskText);
        taskList.appendChild(newTask);

        // Clear the input field
        taskInput.value = '';
        taskInput.focus();
    }

    function deleteTask(taskElement) {
      
        const isCompleted = taskElement.querySelector('input[type="checkbox"]').checked;

        if (isCompleted) {
           
            const completedList = document.getElementById('completed-task-list');
            if (completedList) {
                completedList.removeChild(taskElement);
                checkEmptyCompleted();
            }
        } else {
          
            taskList.removeChild(taskElement);
        }
    }


    function handleTaskToggle(checkbox, label, taskElement) {
        if (checkbox.checked) {
            // Mark as completed
            label.style.textDecoration = 'line-through';
            label.style.opacity = '0.6';

            // Move to completed section
            moveToCompleted(taskElement);
        } else {
            // Unmark - move back to active list
            label.style.textDecoration = 'none';
            label.style.opacity = '1';

            // Move back to active task list
            taskList.appendChild(taskElement);
            checkEmptyCompleted();
        }
    }

    function moveToCompleted(taskElement) {
   
        let completedList = document.getElementById('completed-task-list');

        if (!completedList) {
            completedList = document.createElement('ul');
            completedList.id = 'completed-task-list';
            completedSection.appendChild(completedList);

            // Remove the "No completed tasks yet" message
            const emptyMsg = completedSection.querySelector('p');
            if (emptyMsg) {
                emptyMsg.remove();
            }
        }

        completedList.appendChild(taskElement);
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

    function setupExistingTasks() {
        const existingTasks = taskList.querySelectorAll('li');

        existingTasks.forEach(function (taskElement) {
            const checkbox = taskElement.querySelector('input[type="checkbox"]');
            const label = taskElement.querySelector('label');
            const deleteBtn = taskElement.querySelector('button');

            deleteBtn.addEventListener('click', function () {
                deleteTask(taskElement);
            });

            checkbox.addEventListener('change', function () {
                handleTaskToggle(checkbox, label, taskElement);
            });

            if (checkbox.checked) {
                label.style.textDecoration = 'line-through';
                label.style.opacity = '0.6';
                moveToCompleted(taskElement);
            }
        });
    }


    taskForm.addEventListener('submit', addTask);
    setupExistingTasks();
});