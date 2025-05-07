"""
PEDAL Approval Workflow DAG
This DAG handles manual approvals for the main PEDAL pipeline stages.
Each stage's approval is represented as a separate task that can be manually triggered.
"""

from airflow import DAG
from airflow.operators.python import PythonOperator
from datetime import datetime, timedelta

# Default arguments for all tasks
default_args = {
    'owner': 'pedal',
    'depends_on_past': False,
    'email_on_failure': False,
    'email_on_retry': False,
    'retries': 0,
}

# Simple function that always succeeds - used for manual approval steps
def approve_task(**kwargs):
    """Function for approval tasks. When manually triggered, it will succeed."""
    task_id = kwargs.get('task_id', 'unknown')
    print(f"Approval granted for task: {task_id}")
    return True

# DAG definition
with DAG(
    dag_id='approval_workflow',
    default_args=default_args,
    description='Manual approval gates for PEDAL pipeline',
    start_date=datetime(2025, 4, 7),
    schedule_interval=None,  # Manual triggers only
    catchup=False,
    tags=['pedal', 'approval'],
) as dag:

    # Create approval tasks for each stage of the main pipeline
    approve_requirements_ingest = PythonOperator(
        task_id='approve_requirements_ingest',
        python_callable=approve_task,
        op_kwargs={'task_id': 'requirements_ingest'},
        dag=dag,
    )

    approve_domain_model_generator = PythonOperator(
        task_id='approve_domain_model_generator',
        python_callable=approve_task,
        op_kwargs={'task_id': 'domain_model_generator'},
        dag=dag,
    )

    approve_action_model_generator = PythonOperator(
        task_id='approve_action_model_generator',
        python_callable=approve_task,
        op_kwargs={'task_id': 'action_model_generator'},
        dag=dag,
    )

    approve_openapi_generator = PythonOperator(
        task_id='approve_openapi_generator',
        python_callable=approve_task,
        op_kwargs={'task_id': 'openapi_generator'},
        dag=dag,
    )

    approve_zod_schema_generator = PythonOperator(
        task_id='approve_zod_schema_generator',
        python_callable=approve_task,
        op_kwargs={'task_id': 'zod_schema_generator'},
        dag=dag,
    )

    approve_database_schema_generator = PythonOperator(
        task_id='approve_database_schema_generator',
        python_callable=approve_task,
        op_kwargs={'task_id': 'database_schema_generator'},
        dag=dag,
    )

    # No task dependencies here - each approval task is independent and manually triggered
