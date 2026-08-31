// ============================================================
//  RentalFlow  |  Sprint 4  |  Owner: M4 - Radowanul Haque (Radowan)
//  Part: F20 Staff accounts + audit log API (admin only, raw SQL)
// ============================================================
import { Router } from "express";
import bcrypt from "bcryptjs";
import { query } from "../db.js";
import { authRequired, requireRole } from "../middleware/auth.js";

const router = Router();
const ROLES = ["admin", "staff", "member"];
const STATUSES = ["active", "suspended"];

// Every route in this file is admin-only.
router.use(authRequired, requireRole("admin"));

// GET /api/admin/users — staff directory with each account's activity count.
router.get("/users", async (_req, res) => {
	const { rows } = await query(
		`SELECT u.id, u.name, u.email, u.role, u.status, u.created_at,
            COUNT(a.id) AS action_count,
            MAX(a.created_at) AS last_action_at
       FROM users u
       LEFT JOIN audit_logs a ON a.user_id = u.id
      GROUP BY u.id
      ORDER BY CASE u.role WHEN 'admin' THEN 0 WHEN 'staff' THEN 1 ELSE 2 END, u.name`,
	);
	res.json(rows.map((r) => ({ ...r, action_count: Number(r.action_count) })));
});

// POST /api/admin/users — create a staff account.
router.post("/users", async (req, res) => {
	const { name, email, password, role } = req.body;
	if (!name || !email || !password) {
		return res
			.status(400)
			.json({ error: "name, email and password are required" });
	}
	if (role && !ROLES.includes(role))
		return res.status(400).json({ error: "Invalid role" });
	try {
		const { rows } = await query(
			`INSERT INTO users (name, email, password_hash, role, status)
       VALUES ($1,$2,$3,$4,'active')
       RETURNING id, name, email, role, status, created_at`,
			[name, email, bcrypt.hashSync(password, 10), role || "staff"],
		);
		res.status(201).json(rows[0]);
	} catch (err) {
		if (err.code === "23505")
			return res.status(409).json({ error: "Email already registered" });
		res.status(400).json({ error: err.message });
	}
});

// PATCH /api/admin/users/:id — change a role, or suspend / reactivate.
router.patch("/users/:id", async (req, res) => {
	const { role, status } = req.body;
	if (role && !ROLES.includes(role))
		return res.status(400).json({ error: "Invalid role" });
	if (status && !STATUSES.includes(status))
		return res.status(400).json({ error: "Invalid status" });
	// Guard against an admin locking themselves out of their own console.
	if (
		String(req.user.id) === String(req.params.id) &&
		(status === "suspended" || (role && role !== "admin"))
	) {
		return res
			.status(400)
			.json({
				error: "You cannot suspend or demote your own admin account",
			});
	}
	const { rows } = await query(
		`UPDATE users SET role = COALESCE($2, role), status = COALESCE($3, status)
      WHERE id = $1 RETURNING id, name, email, role, status, created_at`,
		[req.params.id, role || null, status || null],
	);
	if (!rows[0]) return res.status(404).json({ error: "User not found" });
	res.json(rows[0]);
});

// GET /api/admin/audit — the audit trail, newest first.
router.get("/audit", async (req, res) => {
	const { entity, user_id } = req.query;
	const limit = Math.min(Number(req.query.limit) || 100, 500);
	const params = [];
	const clauses = [];
	if (entity) {
		params.push(entity);
		clauses.push(`a.entity = $${params.length}`);
	}
	if (user_id) {
		params.push(user_id);
		clauses.push(`a.user_id = $${params.length}`);
	}
	params.push(limit);
	const { rows } = await query(
		`SELECT a.*, u.name AS user_name
       FROM audit_logs a
       LEFT JOIN users u ON u.id = a.user_id
       ${clauses.length ? `WHERE ${clauses.join(" AND ")}` : ""}
      ORDER BY a.created_at DESC, a.id DESC
      LIMIT $${params.length}`,
		params,
	);
	res.json(rows);
});

// GET /api/admin/audit/summary — activity grouped by entity and by staff member.
router.get("/audit/summary", async (_req, res) => {
	const byEntity = await query(
		`SELECT entity, COUNT(*) AS count FROM audit_logs GROUP BY entity ORDER BY count DESC`,
	);
	const byUser = await query(
		`SELECT COALESCE(u.name, 'Anonymous') AS name, COUNT(*) AS count
       FROM audit_logs a LEFT JOIN users u ON u.id = a.user_id
      GROUP BY u.name ORDER BY count DESC LIMIT 8`,
	);
	const totals = await query(
		`SELECT COUNT(*) AS total,
            COUNT(*) FILTER (WHERE status_code >= 400) AS failed,
            COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') AS last_24h
       FROM audit_logs`,
	);
	res.json({
		byEntity: byEntity.rows.map((r) => ({
			label: r.entity,
			value: Number(r.count),
		})),
		byUser: byUser.rows.map((r) => ({
			label: r.name,
			value: Number(r.count),
		})),
		totals: {
			total: Number(totals.rows[0].total),
			failed: Number(totals.rows[0].failed),
			last24h: Number(totals.rows[0].last_24h),
		},
	});
});

export default router;
