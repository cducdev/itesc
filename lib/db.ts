import sqlite3 from "sqlite3";
import { open } from "sqlite";

// Initialize database
async function initDB() {
	const db = await open({
		filename: "query_logs.db",
		driver: sqlite3.Database,
	});

	await db.exec(`
    CREATE TABLE IF NOT EXISTS query_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp INTEGER NOT NULL,
      original_query TEXT NOT NULL,
      query TEXT NOT NULL,
      results TEXT,
      report TEXT,
      response_time INTEGER,
      status INTEGER
    )
  `);

	return db;
}

// Log a query
export async function logQuery({
	original_query,
	query,
	results,
	report,
	status,
	response_time,
}: {
	original_query: string;
	query: string;
	results?: any;
	report?: string;
	status: number;
	response_time: number;
}) {
	const db = await initDB();

	try {
		await db.run(
			`INSERT INTO query_logs (timestamp, original_query, query, results, report, status, response_time) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
			[
				Date.now(),
				original_query,
				query,
				results ? JSON.stringify(results) : null,
				report,
				status,
				response_time,
			]
		);
	} catch (error) {
		console.error("Error logging query:", error);
	} finally {
		await db.close();
	}
}

// Get all logs
export async function getLogs() {
	const db = await initDB();

	try {
		const logs = await db.all(
			"SELECT * FROM query_logs ORDER BY timestamp DESC"
		);
		return logs.map((log) => ({
			...log,
			results: log.results ? JSON.parse(log.results) : null,
		}));
	} catch (error) {
		console.error("Error getting logs:", error);
		return [];
	} finally {
		await db.close();
	}
}

// Get a single log by ID
export async function getLogById(id: number) {
	const db = await initDB();

	try {
		const log = await db.get("SELECT * FROM query_logs WHERE id = ?", id);
		if (log) {
			return {
				...log,
				results: log.results ? JSON.parse(log.results) : null,
			};
		}
		return null;
	} catch (error) {
		console.error("Error getting log:", error);
		return null;
	} finally {
		await db.close();
	}
}
