class ApiError extends Error{
    counstructor(
        statusCode,
        message='Something Went Wrong',
        error=[],
        stack=''
    ){
        super(message)
        this.statusCode = statusCode
        this.data = null
        this.message = message
        this.success = fasle 
        this.error = error
        if(stack){
            this.stack = stack
        }else{
            Error.captureStackTrace(this, this.counstructor)
        }
    }
}