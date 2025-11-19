"""
Optional: Clean up old session nodes (run periodically via cron job)
"""

from database import db
from datetime import datetime, timedelta

def cleanup_old_sessions(days_old=1):
    """
    Remove nodes from sessions older than specified days.
    Only removes session nodes, never touches global nodes.
    """
    db.connect()
    
    try:
        # Calculate cutoff timestamp
        # Session IDs contain timestamp: session_<timestamp>_<random>
        cutoff_time = datetime.now() - timedelta(days=days_old)
        cutoff_timestamp = int(cutoff_time.timestamp() * 1000)
        
        # Find and delete old session nodes
        query = """
        MATCH (n)
        WHERE n.session_id <> 'global' 
          AND n.session_id IS NOT NULL
          AND toInteger(split(n.session_id, '_')[1]) < $cutoff_timestamp
        DETACH DELETE n
        RETURN count(n) as deleted_count
        """
        
        result = db.execute_cypher(query, {"cutoff_timestamp": cutoff_timestamp})
        deleted = result[0]['deleted_count'] if result else 0
        
        print(f"✅ Cleanup complete!")
        print(f"   - Deleted {deleted} old session nodes")
        print(f"   - Cutoff: {days_old} day(s) old")
        
    except Exception as e:
        print(f"❌ Error during cleanup: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    # Clean up sessions older than 1 day
    cleanup_old_sessions(days_old=1)
