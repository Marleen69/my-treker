  let transactions = JSON.parse(localStorage.getItem('my_finance_data')) || [];

    function addTransaction() {
        const desc = document.getElementById('desc').value;
        const amount = parseFloat(document.getElementById('amount').value);
        const type = document.getElementById('type').value;

        if (!desc || isNaN(amount)) return alert('Заполните поля!');

        transactions.push({ desc, amount, type });
        saveAndRender();

        document.getElementById('desc').value = '';
        document.getElementById('amount').value = '';
    }

    function deleteTransaction(index) {
        transactions.splice(index, 1);
        saveAndRender();
    }

    function saveAndRender() {
        localStorage.setItem('my_finance_data', JSON.stringify(transactions));
        const list = document.getElementById('list');
        const totalEl = document.getElementById('totalBalance');
        
        list.innerHTML = '';
        let total = 0;

        transactions.forEach((t, i) => {
            const isInc = t.type === 'income';
            total += isInc ? t.amount : -t.amount;

            list.innerHTML += `
                <tr>
                    <td>${t.desc}</td>
                    <td class="${t.type}">${isInc ? '+' : '-'}${t.amount}</td>
                    <td style="text-align: right;">
                        <button class="btn-del" onclick="deleteTransaction(${i})">×</button>
                    </td>
                </tr>
            `;
        });

        totalEl.textContent = total.toLocaleString();
        totalEl.style.color = total >= 0 ? 'var(--primary)' : 'var(--danger)';
    }

    saveAndRender();