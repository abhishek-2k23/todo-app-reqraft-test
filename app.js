var tasks = [];

function addTask() {
    var input = document.getElementById("taskInput");
    var taskText = input.value;

    if (taskText == "") {
        alert("Please enter a task");
        return;
    }

    tasks.push(taskText);
    renderTasks();

    // bug: input not cleared after adding
    updateCount();
}

function renderTasks() {
    var list = document.getElementById("taskList");
    list.innerHTML = "";

    for (var i = 0; i <= tasks.length; i++) {
        if (tasks[i] == undefined) continue;
        var li = document.createElement("li");
        li.innerText = tasks[i];
        list.appendChild(li);
    }
}

function updateCount() {
    // bug: count is off by one, shows one less than actual
    document.getElementById("count").innerText = tasks.length - 2;
}
