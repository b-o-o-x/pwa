import { db } from './firebase-config.js';
import { 
    collection, doc, setDoc, getDoc, updateDoc, deleteDoc, 
    onSnapshot, query, where, orderBy, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const urlParams = new URLSearchParams(window.location.search);
let boardId = urlParams.get('bbs'); // Firestore Document ID
let activeNodeId = null;
let isEditMode = false;
let allNodes = [];

// --- 1. 초기 데이터 로드 및 실시간 감시 ---
if (boardId) {
    document.getElementById('del-board-btn').style.display = 'block';
    loadBoardData();
}

function loadBoardData() {
    // A. 게시판 메타데이터(최상위 루트 이름) 실시간 감시
    onSnapshot(doc(db, "boards", boardId), (docSnap) => {
        if(docSnap.exists()) {
            const data = docSnap.data();
            document.getElementById('board-name').value = data.title;
            document.getElementById('root-title-display').innerText = data.title;
        }
    });

    // B. 하위 노드들(Atoms) 실시간 감시
    const q = query(
        collection(db, "atoms"), 
        where("boardId", "==", boardId), 
        orderBy("order", "asc")
    );

    onSnapshot(q, (snapshot) => {
        allNodes = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        renderTree(allNodes, null, document.getElementById('tree-root'));
    });
}

// --- 2. 트리 렌더링 로직 (재귀 호출) ---
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
            <div id="input-${node.id}" class="node-input-group" style="display:none; padding:10px; background:#334155;">
                <input type="text" id="new-node-title-${node.id}" placeholder="하위 노드 제목" style="width:70%;">
                <button onclick="confirmAddNode('${node.id}')" class="btn btn-primary">추가</button>
                <button onclick="hideNodeInput('${node.id}')" class="btn" style="background:#475569; color:white;">취소</button>
            </div>
            <div class="sub-tree" data-parent="${node.id}"></div>
        `;
        container.appendChild(item);
        
        // 하위 계층 렌더링을 위한 재귀 호출
        const subContainer = item.querySelector('.sub-tree');
        renderTree(nodes, node.id, subContainer);
    });

    // 드래그 앤 드롭 활성화 (SortableJS)
    new Sortable(container, {
        group: 'nested',
        handle: '.node-handle',
        animation: 150,
        fallbackOnBody: true,
        swapThreshold: 0.65,
        onEnd: async (evt) => {
            const nodeId = evt.item.dataset.id;
            const newParentId = evt.to.dataset.parent === 'root' ? null : evt.to.dataset.parent;
            
            // 데이터베이스 위치 업데이트
            await updateDoc(doc(db, "atoms", nodeId), {
                parentId: newParentId,
                order: Date.now() // 위치 이동 시 순서 갱신
            });
        }
    });
}

// --- 3. 게시판 및 노드 관리 기능 ---

// 게시판 이름 수정/저장
window.saveBoardInfo = async function() {
    const nameInput = document.getElementById('board-name');
    const newTitle = nameInput.value.trim();
    if (!newTitle) return alert("게시판 이름을 입력하세요.");

    if (!boardId) {
        // 신규 게시판 생성
        const boardRef = doc(db, "boards", newTitle);
        const snap = await getDoc(boardRef);
        if (snap.exists()) return alert("중복된 게시판 이름입니다.");
        
        await setDoc(boardRef, { title: newTitle, updatedAt: serverTimestamp() });
        location.href = `atom-editor.html?bbs=${newTitle}`;
    } else {
        // 기존 게시판 이름 수정
        await updateDoc(doc(db, "boards", boardId), { 
            title: newTitle, 
            updatedAt: serverTimestamp() 
        });
        alert("게시판(최상위 루트) 이름이 수정되었습니다.");
    }
};

// 입력창 제어
window.showNodeInput = function(parentId) {
    const id = parentId || 'root';
    const inputArea = document.getElementById(`input-${id}`);
    if(inputArea) {
        inputArea.style.display = 'block';
        document.getElementById(`new-node-title-${id}`).focus();
    }
};

window.hideNodeInput = function(parentId) {
    const id = parentId || 'root';
    const inputArea = document.getElementById(`input-${id}`);
    if(inputArea) {
        inputArea.style.display = 'none';
        document.getElementById(`new-node-title-${id}`).value = '';
    }
};

// 노드 추가 확정
window.confirmAddNode = async function(parentId) {
    const id = parentId || 'root';
    const titleInput = document.getElementById(`new-node-title-${id}`);
    const title = titleInput.value.trim();

    if (!title) return;
    
    // 같은 게시판 내 노드 이름 중복 체크
    if (allNodes.some(n => n.title === title)) {
        return alert("이미 존재하는 노드 제목입니다.");
    }

    const newNodeRef = doc(collection(db, "atoms"));
    await setDoc(newNodeRef, {
        boardId: boardId,
        parentId: parentId, // 최상위 자식이면 null
        title: title,
        content: "",
        order: Date.now(),
        updatedAt: serverTimestamp()
    });

    hideNodeInput(parentId);
};

// --- 4. 에디터 및 콘텐츠 제어 ---

window.selectNode = async function(nodeId) {
    activeNodeId = nodeId;
    const node = allNodes.find(n => n.id === nodeId);
    if (!node) return;

    // UI 활성화 상태 표시
    document.querySelectorAll('.node-row').forEach(el => el.classList.remove('active'));
    const activeRow = document.querySelector(`.node-row[data-id="${nodeId}"]`);
    if(activeRow) activeRow.classList.add('active');

    document.getElementById('active-node-title').innerText = node.title;
    document.getElementById('action-buttons').style.display = 'flex';
    
    // 렌더링 및 에디터 값 설정
    const viewer = document.getElementById('viewer');
    viewer.innerHTML = node.content ? marked.parse(node.content) : "<p style='color:#ccc'>내용이 없습니다. [쓰기/수정] 버튼을 눌러 내용을 채워보세요.</p>";
    document.getElementById('editor').value = node.content || "";
    
    exitEditMode();
};

window.toggleEditMode = function() {
    isEditMode = !isEditMode;
    const viewer = document.getElementById('viewer');
    const editor = document.getElementById('editor');
    const btnSave = document.getElementById('btn-save');
    const btnToggle = document.getElementById('btn-toggle');

    viewer.style.display = isEditMode ? 'none' : 'block';
    editor.style.display = isEditMode ? 'block' : 'none';
    btnSave.style.display = isEditMode ? 'inline-block' : 'none';
    btnToggle.innerText = isEditMode ? '취소' : '쓰기/수정';
    
    if(isEditMode) editor.focus();
};

window.exitEditMode = function() {
    isEditMode = false;
    document.getElementById('viewer').style.display = 'block';
    document.getElementById('editor').style.display = 'none';
    document.getElementById('btn-save').style.display = 'none';
    document.getElementById('btn-toggle').innerText = '쓰기/수정';
};

window.saveNodeContent = async function() {
    if (!activeNodeId) return;
    const content = document.getElementById('editor').value;
    
    try {
        await updateDoc(doc(db, "atoms", activeNodeId), {
            content: content,
            updatedAt: serverTimestamp()
        });
        alert("내용이 성공적으로 저장되었습니다.");
        selectNode(activeNodeId); // 뷰어 모드로 전환 및 갱신
    } catch (e) {
        console.error(e);
        alert("저장 중 오류가 발생했습니다.");
    }
};

window.clearNodeContent = async function() {
    if(confirm("정말로 이 노드의 내용을 모두 삭제하시겠습니까? (노드 제목은 유지됩니다)")) {
        document.getElementById('editor').value = "";
        await saveNodeContent();
    }
};

window.deleteBoard = async function() {
    if(confirm("게시판과 포함된 모든 노드 데이터가 영구 삭제됩니다. 계속하시겠습니까?")) {
        // 실제 운영 시에는 모든 Atoms를 먼저 삭제하는 로직이 필요합니다.
        await deleteDoc(doc(db, "boards", boardId));
        location.href = 'index.html';
    }
};
