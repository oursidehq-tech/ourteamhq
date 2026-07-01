import { useEffect, useState } from "react";
import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  orderBy,
  query,
} from "firebase/firestore";
import { db } from "../config/firebase";
import { useClub } from "../context/ClubContext";
import Modal from "../components/Modal";
import TeamGroupDetail from "../components/TeamGroupDetail";
import { Search, Plus, Edit2, Trash2, Eye } from "lucide-react";

export default function GroupsPage() {
  const { selectedClubId } = useClub();
  const [groups, setGroups] = useState([]);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(null); // null | 'add' | group obj
  const [viewingItem, setViewingItem] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  const col = () => collection(db, "clubs", selectedClubId, "groups");

  const fetch = async () => {
    if (!selectedClubId) return;
    try {
      const snap = await getDocs(query(col(), orderBy("groupName")));
      setGroups(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch {
      const snap = await getDocs(col());
      setGroups(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }
  };

  useEffect(() => {
    fetch();
  }, [selectedClubId]);

  const filtered = groups.filter((g) =>
    `${g.groupName || ""} ${g.groupType || ""}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const openAdd = () => {
    setForm({ groupName: "", groupType: "Custom" });
    setModal("add");
  };

  const openEdit = (group) => {
    setForm({
      groupName: group.groupName || "",
      groupType: group.groupType || "Custom",
    });
    setModal(group);
  };

  const isLockedGroup = (group) => group?.system || group?.source === "team";

  const handleSave = async () => {
    if (!form.groupName?.trim()) return alert("Group name is required");
    setSaving(true);
    try {
      if (modal === "add") {
        const ref = doc(col());
        await setDoc(ref, {
          groupId: ref.id,
          groupName: form.groupName.trim(),
          groupType: form.groupType || "Custom",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        await updateDoc(doc(db, "clubs", selectedClubId, "groups", modal.id), {
          groupName: form.groupName.trim(),
          groupType: form.groupType || "Custom",
          updatedAt: serverTimestamp(),
        });
      }
      await fetch();
      setModal(null);
    } catch (err) {
      alert(err.message);
    }
    setSaving(false);
  };

  const handleDelete = async (group) => {
    if (isLockedGroup(group)) {
      alert("System or team groups cannot be deleted.");
      return;
    }
    if (!window.confirm(`Delete group "${group.groupName}"?`)) return;
    await deleteDoc(doc(db, "clubs", selectedClubId, "groups", group.id));
    await fetch();
  };

  if (viewingItem) {
    return (
      <TeamGroupDetail 
        item={viewingItem} 
        itemType="group" 
        selectedClubId={selectedClubId} 
        onClose={() => setViewingItem(null)} 
      />
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Groups</h1>
          <p>Manage club groups and committees</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={openAdd}>
            <Plus size={16} />Add Group
          </button>
        </div>
      </div>

      <div className="table-container">
        <div className="table-toolbar">
          <h3>{filtered.length} Group{filtered.length !== 1 ? "s" : ""}</h3>
          <div className="search-box">
            <Search size={16} />
            <input
              placeholder="Search groups…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Group Name</th>
              <th>Type</th>
              <th>Source</th>
              <th>Created</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="table-empty">
                  No groups found
                </td>
              </tr>
            ) : (
              filtered.map((g) => (
                <tr key={g.id}>
                  <td>
                    <strong>{g.groupName || "—"}</strong>
                  </td>
                  <td>{g.groupType || "Custom"}</td>
                  <td>{g.source || (g.system ? "system" : "manual")}</td>
                  <td className="text-sm text-muted">
                    {g.createdAt?.toDate?.().toLocaleDateString() || "—"}
                  </td>
                  <td>
                    <div className="flex gap-sm">
                      <button
                        className="btn-icon"
                        onClick={() => setViewingItem(g)}
                        title="View Details"
                      >
                        <Eye size={15} />
                      </button>
                      <button
                        className="btn-icon"
                        onClick={() => openEdit(g)}
                        disabled={isLockedGroup(g)}
                        title={isLockedGroup(g) ? "Locked" : "Edit"}
                      >
                        <Edit2 size={15} />
                      </button>
                      <button
                        className="btn-icon danger"
                        onClick={() => handleDelete(g)}
                        disabled={isLockedGroup(g)}
                        title={isLockedGroup(g) ? "Locked" : "Delete"}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={modal === "add" ? "Add Group" : "Edit Group"}
      >
        <div className="form-group">
          <label>Group Name</label>
          <input
            className="form-control"
            value={form.groupName || ""}
            onChange={(e) => setForm({ ...form, groupName: e.target.value })}
            disabled={modal && modal !== "add" && isLockedGroup(modal)}
          />
        </div>
        <div className="form-group">
          <label>Group Type</label>
          <input
            className="form-control"
            value={form.groupType || ""}
            onChange={(e) => setForm({ ...form, groupType: e.target.value })}
            disabled={modal && modal !== "add" && isLockedGroup(modal)}
          />
        </div>
        <div className="form-actions">
          <button className="btn btn-outline" onClick={() => setModal(null)}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving || (modal && modal !== "add" && isLockedGroup(modal))}
          >
            {saving ? "Saving…" : modal === "add" ? "Create Group" : "Save Changes"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
