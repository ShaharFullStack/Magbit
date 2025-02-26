// script.js
const db = new Dexie("IncomeTrackerDB");
db.version(1).stores({
    students: "name, price",
    payments: "++id, student, date, amount"
});

const studentForm = document.getElementById('studentForm');
const paymentForm = document.getElementById('paymentForm');
const studentsTable = document.getElementById('studentsTable');
const paymentsTable = document.getElementById('paymentsTable');
const totalIncomeElement = document.getElementById('totalIncome');
const clearAllPaymentsBtn = document.getElementById('clearAllPayments');
const printPaymentsBtn = document.getElementById('printPayments');
const accordions = document.querySelectorAll('.accordion');

async function loadStudents() {
    const students = await db.students.toArray();
    studentsTable.innerHTML = '';
    const studentSelect = document.getElementById('student');
    studentSelect.innerHTML = '';

    students.forEach(student => {
        const row = studentsTable.insertRow();
        row.insertCell(0).textContent = '₪' + student.price;
        row.insertCell(1).textContent = student.name;

        const cellBtn = row.insertCell(2);
        const removeButton = document.createElement('button');
        removeButton.textContent = 'הסר';
        removeButton.className = 'btn';
        removeButton.onclick = async () => {
            const payments = await db.payments.where('student').equals(student.name).toArray();
            if (payments.length > 0) {
                if (!confirm(`לתלמיד ${student.name} יש ${payments.length} תשלומים. האם אתה בטוח שברצונך להסיר?`)) {
                    return;
                }
            }
            await db.students.delete(student.name);
            loadStudents();
            loadPayments();
        };
        cellBtn.appendChild(removeButton);

        const option = document.createElement('option');
        option.value = student.name;
        option.textContent = student.name;
        studentSelect.appendChild(option);
    });
}

async function loadPayments() {
    const payments = await db.payments.toArray();
    paymentsTable.innerHTML = '';
    let totalIncome = 0;
    const lessonCounts = {};

    payments.forEach(payment => {
        const row = paymentsTable.insertRow();
        row.insertCell(0).textContent = payment.student;
        row.insertCell(1).textContent = payment.date;
        row.insertCell(2).textContent = '₪' + payment.amount;

        const cellRemove = row.insertCell(3);
        const removeButton = document.createElement('button');
        removeButton.textContent = 'הסר';
        removeButton.className = 'btn';
        removeButton.onclick = async () => {
            await db.payments.delete(payment.id);
            loadPayments();
        };
        cellRemove.appendChild(removeButton);

        const cellPrint = row.insertCell(4);
        const printButton = document.createElement('button');
        printButton.textContent = 'הדפס קבלה';
        printButton.className = 'btn';
        printButton.onclick = () => printPaymentReceipt(payment.student);
        cellPrint.appendChild(printButton);

        totalIncome += parseFloat(payment.amount);
        lessonCounts[payment.student] = (lessonCounts[payment.student] || 0) + 1;
    });

    totalIncomeElement.textContent = totalIncome.toFixed(2);
    const chartData = {
        labels: Object.keys(lessonCounts).sort(),
        values: Object.keys(lessonCounts).sort().map(name => lessonCounts[name])
    };
    updateChart(chartData);
}

studentForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const name = document.getElementById('studentName').value.trim();
    const price = parseFloat(document.getElementById('lessonPrice').value);

    if (!name || isNaN(price) || price <= 0) {
        alert('אנא הזן שם תלמיד תקין ומחיר חיובי.');
        return;
    }

    const existingStudent = await db.students.get(name);
    if (existingStudent) {
        alert('תלמיד עם שם זה כבר קיים.');
        return;
    }

    await db.students.add({ name, price: price.toFixed(2) });
    loadStudents();
    studentForm.reset();
});

paymentForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const student = document.getElementById('student').value;
    const date = document.getElementById('date').value;

    if (!date || new Date(date) > new Date()) {
        alert('אנא בחר תאריך תקין (לא עתידי).');
        return;
    }

    const studentData = await db.students.get(student);
    if (!studentData) {
        alert('התלמיד לא קיים.');
        return;
    }

    const amount = studentData.price;
    await db.payments.add({ student, date, amount });
    loadPayments();
    document.getElementById('date').value = '';
});

clearAllPaymentsBtn.addEventListener('click', async () => {
    const payments = await db.payments.toArray();
    if (payments.length === 0) {
        alert('אין תשלומים לנקות.');
        return;
    }
    if (confirm('האם אתה בטוח שברצונך לנקות את כל התשלומים?')) {
        await db.payments.clear();
        loadPayments();
    }
});

printPaymentsBtn.addEventListener('click', async () => {
    const payments = await db.payments.toArray();
    if (payments.length === 0) {
        alert('אין תשלומים להדפסה.');
        return;
    }
    let paymentDetails = payments.map(payment => `
        <tr>
            <td>${payment.student}</td>
            <td>${payment.date}</td>
            <td>₪${payment.amount}</td>
        </tr>
    `).join('');
    const printWindow = window.open('', '', 'height=600,width=800');
    printWindow.document.write(`
        <html>
        <head><title>הדפסת תשלומים</title><link rel="stylesheet" href="styles.css"></head>
        <body style="font-size: 20px; text-align: right; direction: rtl;">
            <h2>קבלת תשלומים</h2>
            <table><thead><tr><th>תלמיד</th><th>תאריך</th><th>סכום</th></tr></thead><tbody>${paymentDetails}</tbody></table>
        </body>
        </html>
    `);
    printWindow.document.close();
    printWindow.print();
});

async function printPaymentReceipt(studentName) {
    const payments = await db.payments.where('student').equals(studentName).toArray();
    if (payments.length === 0) {
        alert(`אין תשלומים עבור ${studentName}.`);
        return;
    }
    let paymentDetails = '';
    let totalAmount = 0;
    payments.forEach(payment => {
        paymentDetails += `
            <tr>
                <td>${payment.student}</td>
                <td>${payment.date}</td>
                <td>₪${payment.amount}</td>
            </tr>
        `;
        totalAmount += parseFloat(payment.amount);
    });
    const printWindow = window.open('', '', 'height=600,width=800');
    printWindow.document.write(`
        <html>
        <head><title>הדפסת קבלה</title><link rel="stylesheet" href="styles.css"></head>
        <body style="font-size: 20px; text-align: right; direction: rtl;">
            <h2>קבלה עבור ${studentName}</h2>
            <table><thead><tr><th>תלמיד</th><th>תאריך</th><th>סכום</th></tr></thead><tbody>${paymentDetails}</tbody></table>
            <h3>סה"כ: ₪${totalAmount.toFixed(2)}</h3>
        </body>
        </html>
    `);
    printWindow.document.close();
    printWindow.print();
}

accordions.forEach((acc) => {
    acc.addEventListener('click', function() {
        this.classList.toggle('active');
        const panel = this.nextElementSibling;
        panel.classList.toggle('active');
        panel.style.maxHeight = panel.classList.contains('active') ? panel.scrollHeight + 'px' : null;
    });
});

document.addEventListener("DOMContentLoaded", async () => {
    const initialStudents = [
        { name: "האפליקציה נכתבה ע''י שחר מעוז", price: "1.00" },
        { name: "כל הזכויות שמורות ", price: "1.00" },
    ];
    for (const student of initialStudents) {
        if (!await db.students.get(student.name)) {
            await db.students.add(student);
        }
    }
    loadStudents();
    loadPayments();
});