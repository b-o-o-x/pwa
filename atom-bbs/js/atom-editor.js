import { db } from './firebase-config.js';
import { 
    collection, doc, setDoc, getDoc, updateDoc, deleteDoc, 
    onSnapshot, query, where, orderBy, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const urlParams = new URLSearchParams(window.location.search);
let boardId = urlParams.get('bbs'); // 이 값은 고유 문서 ID (바뀌지 않음)
let activeNodeId = null;
let allNodes = [];

// 1. 초기 로드
if (boardId) {
    document.getElementById('del-board-btn').style.display = 'block';
    loadBoardData();
}

// 2. 게시판(최상위 루트) 이름 수정/저장
window.saveBoardInfo = async function() {
    const nameInput = document.getElementById('board-name');
    const newTitle = nameInput.value.trim();
    if (!newTitle) return alert("이름을 입력하세요.");

    // 신규 생성 시
    if (!boardId) {
        const boardRef = doc(db, "boards", newTitle); // 제목을 ID로 사용
        const snap = await getDoc(boardRef);
        if (snap.exists()) return alert("중복된 게시판 이름입니다.");
        
        await setDoc(boardRef, { title: newTitle, updatedAt: serverTimestamp() });
        location.href = `atom-editor.html?bbs=${newTitle}`;
    } else {
        // 기존 수정 시
        await updateDoc(doc(db, "boards", boardId), { 
            title: newTitle, 
            updatedAt: serverTimestamp() 
        });
        document.getElementById('root-title-display').innerText = newTitle;
        alert("게시판 이름이 수정되었습니다.");
    }
};

// 3. 실시간 동기화
function loadBoardData() {
    // 게시판 메타데이터 가져오기
    onSnapshot(doc(db, "boards", boardId), (doc) => {
        if(doc.exists()) {
            const data = doc.data();
            document.getElementById('board-name').value = data.title;
            document.getElementById('root-title-display').innerText = data.title;
        }
    });

    // 하위 노드들 가져오기
    const q = query(collection(db, "atoms"), where("boardId", "==", boardId), orderBy("order", "asc"));
    onSnapshot(q, (snapshot) => {
        allNodes = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        renderTree(allNodes, null, document.getElementById('tree-root'));
    });
}

// 4. 트리 렌더링 (입력창 포함)
function renderTree(nodes, parentId, container) {
    container.innerHTML = '';
    const filtered = nodes.filter(n => n.parentId === parentId);

    filtered.forEach(node => {
        const item = document.createElement('div');
        item.className = 'tree-item';
        item.dataset.id = node.id;
        item.innerHTML = `
            <div class="node-row ${activeNodeId === node.id ? 'active' : ''}" data-id="${node.id}">
                <i class="fas fa-grip-lines node-handle"></i>
                <span class="node-title" onclick="selectNode('${node.id}')">${node.title}</span>
                <i class="fas fa-plus-circle" onclick="showNodeInput('${node.id}')" style="margin-left:auto; cursor:pointer;"></i>
            </div>
            <div id="input-${node.id}" class="node-input-group">
                <input type="text" id="new-node-title-${node.id}" placeholder="하위 노드 제목">
                <button onclick="confirmAddNode('${node.id}')">추가</button>
                <button onclick="hideNodeInput('${node.id}')" style="background:#475569;">취소</button>
            </div>
            <div class="sub-tree" data-parent="${node.id}"></div>
        `;
        container.appendChild(item);
        renderTree(nodes, node.id, item.querySelector('.sub-tree'));
    });

    // SortableJS 초기화
    new Sortable(container, {
        group: 'nested',
        handle: '.node-handle',
        animation: 150,
        onEnd: async (evt) => {
            const nodeId = evt.item.dataset.id;
            const newParentId = evt.to.dataset.parent === 'root' ? null : evt.to.dataset.parent;
            await updateDoc(doc(db, "atoms", nodeId), { parentId: newParentId, order: Date.now() });
        }
    });
}

// 5. 노드 입력창 제어
window.showNodeInput = function(parentId) {
    const id = parentId || 'root';
    document.getElementById(`input-${id}`).style.display = 'block';
    document.getElementById(`new-node-title-${id}`).focus();
};

window.hideNodeInput = function(parentId) {
    const id = parentId || 'root';
    document.getElementById(`input-${id}`).style.display = 'none';
    document.getElementById(`new-node-title-${id}`).value = '';
};

window.confirmAddNode = async function(parentId) {
    const id = parentId || 'root';
    const titleInput = document.getElementById(`new-node-title-${id}`);
    const title = titleInput.value.trim();

    if (!title) return;
    if (allNodes.some(n => n.title === title)) return alert("이미 존재하는 노드 제목입니다.");

    const newNodeRef = doc(collection(db, "atoms"));
    await setDoc(newNodeRef, {
        boardId: boardId,
        parentId: parentId, // 최상위 자식이면 null
        title: title,
        content: "",
        order: Date.now()
    });

    hideNodeInput(parentId);
};

// ... 나머지 selectNode, toggleEditMode, saveNodeContent 등은 이전과 동일하게 유지 ...
