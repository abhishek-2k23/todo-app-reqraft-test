document.addEventListener('DOMContentLoaded', () => {
    const display = document.getElementById('display');
    const buttons = document.querySelectorAll('button');
    
    buttons.forEach(button => {
        button.addEventListener('click', () => {
            if (button.id === 'equals') {
                try {
                    display.value = evaluateExpression(display.value);
                } catch (error) {
                    display.value = error.message;
                }
            } else if (button.id === 'clear') {
                display.value = '';
            } else {
                display.value += button.textContent;
            }
        });
    });
});

function evaluateExpression(expression) {
    // Evaluate expression using BODMAS rules
    try {
        let result = new Function('return ' + expression.replace(/\b(\d+)\b/g, 'Number($1)'))();
        if (!isFinite(result)) {
            throw new Error('Cannot divide by zero');
        }
        return result;
    } catch (error) {
        throw new Error('Invalid Expression');
    }
}

function add(a, b) {
    return a + b;
}

function subtract(a, b) {
    return a - b;
}

function multiply(a, b) {
    return a * b;
}

function divide(a, b) {
    if (b === 0) throw new Error('Cannot divide by zero');
    return a / b;
}