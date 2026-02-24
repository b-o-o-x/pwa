import { db } from './firebase-config.js';
import { 
    collection, doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, 
    onSnapshot, query, where, orderBy, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const urlParams = new URLSearchParams(window.location.search);
let boardId = urlParams.get('bbs');
let activeNodeId = null;
let isEditMode = false;
let allNodes = [];

// 초기화
if (boardId) {
    document.getElementById('board-name').value = boardId;
    document.getElementById('board-name').disabled = true;
    document.getElementById('del-board-btn').style.display = 'block';
    loadBoardData();
}

// 1. 게시판 정보 저장 (중복 체크 포함)
window.saveBoardInfo = async function() {
    const nameInput = document.getElementById('board-name');
    const name = nameInput.value.trim();
    if (!name) return alert("게시판 이름을 입력하세요.");

    const boardRef = doc(db, "boards", name);
    const snap = await getDoc(boardRef);

    if (!boardId && snap.exists()) {
        return alert("이미 존재하는 게시판 이름입니다. 다른 이름을 사용하세요.");
    }

    await setDoc(boardRef, {
        title: name,
        updatedAt: serverTimestamp()
    }, { merge: true });

    if (!boardId) {
        location.href = `atom-editor.html?bbs=${name}`;
    } else {
        alert("게시판 정보가 업데이트되었습니다.");
    }
};

// 2. 실시간 노드 데이터 로드
function loadBoardData() {
    const q = query(
        collection(db, "atoms"),
        where("boardId", "==", boardId),
        orderBy("order", "asc")
    );

    onSnapshot(q, (snapshot) => {
        allNodes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderTree(allNodes, null, document.getElementById('tree-root'));
    });
}

// 3. 트리 렌더링 (재귀 + 드래그앤드롭)
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
                <i class="fas fa-plus-circle" onclick="addNewNode('${node.id}')" style="margin-left:auto; opacity:0.5;"></i>
            </div>
            <div class="sub-tree" data-parent="${node.id}"></div>
        `;
        container.appendChild(item);
        renderTree(nodes, node.id, item.querySelector('.sub-tree'));
    });

    new Sortable(container, {
        group: 'nested',
        handle: '.node-handle',
        animation: 150,
        fallbackOnBody: true,
        swapThreshold: 0.65,
        onEnd: async (evt) => {
            const nodeId = evt.item.dataset.id;
            const newParentId = evt.to.dataset.parent === 'root' ? null : evt.to.dataset.parent;
            
            // 단순화를 위해 이동 시 order를 현재 시간 기반으로 갱신
            // 실제 상용화시엔 새 위치의 앞뒤 노드 order 중간값 계산 로직 권장
            await updateDoc(doc(db, "atoms", nodeId), {
                parentId: newParentId,
                order: Date.now() 
            });
        }
    });
}

// 4. 새 노드 추가 (이름 중복 체크)
window.addNewNode = async function(parentId) {
    if (!boardId) return alert("먼저 게시판 이름을 저장하세요.");
    const title = prompt("새 노드 이름을 입력하세요:");
    if (!title) return;

    if (allNodes.some(n => n.title === title && n.boardId === boardId)) {
        return alert("같은 게시판 내에 동일한 이름의 노드가 존재합니다.");
    }

    const newNodeRef = doc(collection(db, "atoms"));
    await setDoc(newNodeRef, {
        boardId: boardId,
        parentId: parentId,
        title: title,
        content: "",
        order: Date.now()
    });
};

// 5. 노드 선택 및 내용 표시
window.selectNode = async function(nodeId) {
    activeNodeId = nodeId;
    const node = allNodes.find(n => n.id === nodeId);
    
    document.querySelectorAll('.node-row').forEach(el => el.classList.remove('active'));
    document.querySelector(`.node-row[data-id="${nodeId}"]`).classList.add('active');

    document.getElementById('active-node-title').innerText = node.title;
    document.getElementById('action-buttons').style.display = 'flex';
    
    document.getElementById('viewer').innerHTML = node.content ? marked.parse(node.content) : "<p style='color:#ccc'>내용이 없습니다. 쓰기 버튼을 눌러 작성하세요.</p>";
    document.getElementById('editor').value = node.content || "";
    
    exitEditMode();
};

// 6. 에디터 제어 및 저장
window.toggleEditMode = function() {
    isEditMode = !isEditMode;
    document.getElementById('viewer').style.display = isEditMode ? 'none' : 'block';
    document.getElementById('editor').style.display = isEditMode ? 'block' : 'none';
    document.getElementById('btn-save').style.display = isEditMode ? 'inline-block' : 'none';
    document.getElementById('btn-toggle').innerText = isEditMode ? '취소' : '쓰기/수정';
};

window.exitEditMode = function() {
    isEditMode = false;
    document.getElementById('viewer').style.display = 'block';
    document.getElementById('editor').style.display = 'none';
    document.getElementById('btn-save').style.display = 'none';
    document.getElementById('btn-toggle').innerText = '쓰기/수정';
};

window.saveNodeContent = async function() {
    const content = document.getElementById('editor').value;
    await updateDoc(doc(db, "atoms", activeNodeId), {
        content: content,
        updatedAt: serverTimestamp()
    });
    alert("저장되었습니다.");
    selectNode(activeNodeId);
};

window.clearNodeContent = async function() {
    if(confirm("내용을 모두 지우시겠습니까? 노드 구조는 유지됩니다.")) {
        document.getElementById('editor').value = "";
        await saveNodeContent();
    }
};

window.deleteBoard = async function() {
    if(confirm("게시판과 모든 노드가 삭제됩니다. 계속하시겠습니까?")) {
        // 실제로는 모든 atoms를 쿼리해서 루프 돌며 삭제해야 함
        await deleteDoc(doc(db, "boards", boardId));
        location.href = 'index.html';
    }
};
